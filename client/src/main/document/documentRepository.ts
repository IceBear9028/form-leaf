import { existsSync } from "node:fs";
import {
  mkdir,
  readdir,
  rename,
  stat,
  unlink,
} from "node:fs/promises";
import {
  createDefaultDocument,
  isWorkspaceDocument,
  isV1WorkspaceDocument,
  type WorkspaceDocument,
} from "../../foundation/document.ts";
import {
  createEmptyLibraryIndex,
  DEFAULT_DOCUMENT_TITLE,
  isDocumentLibraryIndex,
  normalizeDocumentTitle,
  sortDeletedDocumentSummaries,
  sortDocumentSummaries,
  summaryFromDocument,
  type DeletedDocumentSummary,
  type DocumentLibraryIndex,
  type DocumentSummary,
} from "../../foundation/documentLibrary.ts";
import { readJsonWithBackup, writeJsonAtomically } from "./atomicJsonStore.ts";
import { migrateStoredDocument } from "./documentMigration.ts";
import {
  createDocumentPaths,
  DOCUMENT_BACKUP_SUFFIXES,
  DOCUMENT_SUFFIX,
  type DocumentPaths,
} from "./documentPaths.ts";

export class DocumentRepository {
  private operationQueue: Promise<void> = Promise.resolve();
  private initializationPromise: Promise<void> | undefined;
  private readonly paths: DocumentPaths;

  constructor(workspaceDirectory: string) {
    this.paths = createDocumentPaths(workspaceDirectory);
  }

  list(): Promise<DocumentSummary[]> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      const index = await this.reconcileIndex(await this.readIndex());
      return sortDocumentSummaries(index.resumes);
    });
  }

  listTrash(): Promise<DeletedDocumentSummary[]> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      const index = await this.reconcileIndex(await this.readIndex());
      return sortDeletedDocumentSummaries(index.trash);
    });
  }

  create(): Promise<{ summary: DocumentSummary; document: WorkspaceDocument }> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      const createdAt = new Date().toISOString();
      const document: WorkspaceDocument = {
        ...createDefaultDocument(),
        name: DEFAULT_DOCUMENT_TITLE,
        updatedAt: createdAt,
      };
      assertSafeId(document.documentId);
      await this.writeDocument(this.paths.activeDocument(document.documentId), document);

      const index = await this.readIndex();
      const summary = summaryFromDocument(document, createdAt);
      await this.writeIndex({
        ...index,
        resumes: sortDocumentSummaries([
          ...index.resumes.filter((item) => item.id !== summary.id),
          summary,
        ]),
      });
      return { summary, document };
    });
  }

  load(id: string): Promise<WorkspaceDocument> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      assertSafeId(id);
      const index = await this.readIndex();
      if (!index.resumes.some((item) => item.id === id)) {
        throw new Error("요청한 이력서를 목록에서 찾을 수 없습니다.");
      }
      const document = await this.readDocument(this.paths.activeDocument(id));
      if (document.documentId !== id) {
        throw new Error("이력서 ID와 저장 파일이 일치하지 않습니다.");
      }
      return document;
    });
  }

  save(id: string, document: WorkspaceDocument): Promise<DocumentSummary> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      return this.saveInside(id, document);
    });
  }

  rename(id: string, title: string): Promise<DocumentSummary> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      assertSafeId(id);
      const document = await this.readDocument(this.paths.activeDocument(id));
      return this.saveInside(id, {
        ...document,
        name: normalizeDocumentTitle(title),
      });
    });
  }

  remove(id: string): Promise<void> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      assertSafeId(id);
      const index = await this.readIndex();
      const summary = index.resumes.find((item) => item.id === id);
      if (!summary) throw new Error("삭제할 이력서를 찾을 수 없습니다.");

      const source = this.paths.activeDocument(id);
      const destination = this.paths.trashDocument(id);
      if (!existsSync(source)) throw new Error("삭제할 이력서 파일을 찾을 수 없습니다.");
      if (existsSync(destination) || DOCUMENT_BACKUP_SUFFIXES.some((suffix) =>
        existsSync(`${destination}${suffix}`))) {
        throw new Error("휴지통에 같은 ID의 이력서가 이미 있습니다.");
      }

      await rename(source, destination);
      const movedBackups: string[] = [];
      try {
        for (const suffix of DOCUMENT_BACKUP_SUFFIXES) {
          if (!existsSync(`${source}${suffix}`)) continue;
          await rename(`${source}${suffix}`, `${destination}${suffix}`);
          movedBackups.push(suffix);
        }
        const deleted: DeletedDocumentSummary = {
          ...summary,
          deletedAt: new Date().toISOString(),
        };
        await this.writeIndex({
          ...index,
          resumes: index.resumes.filter((item) => item.id !== id),
          trash: sortDeletedDocumentSummaries([
            ...index.trash.filter((item) => item.id !== id),
            deleted,
          ]),
        });
      } catch (error) {
        for (const suffix of movedBackups.reverse()) {
          if (existsSync(`${destination}${suffix}`)) {
            await rename(`${destination}${suffix}`, `${source}${suffix}`).catch(() => undefined);
          }
        }
        if (existsSync(destination)) {
          await rename(destination, source).catch(() => undefined);
        }
        throw error;
      }
    });
  }

  restore(id: string): Promise<DocumentSummary> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      assertSafeId(id);
      const index = await this.readIndex();
      const deleted = index.trash.find((item) => item.id === id);
      if (!deleted) throw new Error("복원할 이력서를 휴지통에서 찾을 수 없습니다.");
      if (index.resumes.some((item) => item.id === id)) {
        throw new Error("같은 ID의 이력서가 목록에 있어 복원할 수 없습니다.");
      }

      const source = this.paths.trashDocument(id);
      const destination = this.paths.activeDocument(id);
      if (!existsSync(source)) throw new Error("복원할 이력서 파일을 찾을 수 없습니다.");
      if (existsSync(destination) || DOCUMENT_BACKUP_SUFFIXES.some((suffix) =>
        existsSync(`${destination}${suffix}`))) {
        throw new Error("같은 ID의 이력서 파일이 있어 덮어쓰지 않았습니다.");
      }

      await rename(source, destination);
      const movedBackups: string[] = [];
      try {
        for (const suffix of DOCUMENT_BACKUP_SUFFIXES) {
          if (!existsSync(`${source}${suffix}`)) continue;
          await rename(`${source}${suffix}`, `${destination}${suffix}`);
          movedBackups.push(suffix);
        }
        const { deletedAt: _deletedAt, ...summary } = deleted;
        await this.writeIndex({
          ...index,
          resumes: sortDocumentSummaries([...index.resumes, summary]),
          trash: index.trash.filter((item) => item.id !== id),
        });
        return summary;
      } catch (error) {
        for (const suffix of movedBackups.reverse()) {
          if (existsSync(`${destination}${suffix}`)) {
            await rename(`${destination}${suffix}`, `${source}${suffix}`).catch(() => undefined);
          }
        }
        if (existsSync(destination)) {
          await rename(destination, source).catch(() => undefined);
        }
        throw error;
      }
    });
  }

  permanentlyDelete(id: string): Promise<void> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      assertSafeId(id);
      const index = await this.readIndex();
      const deleted = index.trash.find((item) => item.id === id);
      if (!deleted) throw new Error("완전히 삭제할 이력서를 휴지통에서 찾을 수 없습니다.");

      const path = this.paths.trashDocument(id);
      if (!existsSync(path)) throw new Error("완전히 삭제할 이력서 파일을 찾을 수 없습니다.");
      await this.writeIndex({
        ...index,
        trash: index.trash.filter((item) => item.id !== id),
      });

      try {
        for (const suffix of DOCUMENT_BACKUP_SUFFIXES) {
          if (existsSync(`${path}${suffix}`)) await unlink(`${path}${suffix}`);
        }
        await unlink(path);
      } catch (error) {
        await this.writeIndex(index).catch(() => undefined);
        throw error;
      }
    });
  }

  private async saveInside(id: string, document: WorkspaceDocument): Promise<DocumentSummary> {
    assertSafeId(id);
    if (!isWorkspaceDocument(document)) {
      throw new Error("저장할 이력서의 데이터 형식이 올바르지 않습니다.");
    }
    if (document.documentId !== id) {
      throw new Error("요청한 이력서 ID와 문서 ID가 일치하지 않습니다.");
    }

    const index = await this.readIndex();
    const currentSummary = index.resumes.find((item) => item.id === id);
    if (!currentSummary) throw new Error("저장할 이력서를 목록에서 찾을 수 없습니다.");

    const updatedAt = new Date().toISOString();
    const nextDocument: WorkspaceDocument = {
      ...document,
      name: normalizeDocumentTitle(document.name),
      updatedAt,
    };
    await this.writeDocument(this.paths.activeDocument(id), nextDocument);
    const summary = summaryFromDocument(nextDocument, currentSummary.createdAt);
    await this.writeIndex({
      ...index,
      resumes: sortDocumentSummaries(index.resumes.map((item) =>
        item.id === id ? summary : item,
      )),
    });
    return summary;
  }

  private ensureInitialized(): Promise<void> {
    this.initializationPromise ??= this.initialize();
    return this.initializationPromise;
  }

  private async initialize(): Promise<void> {
    await mkdir(this.paths.activeDirectory, { recursive: true });
    await mkdir(this.paths.trashDirectory, { recursive: true });

    if (existsSync(this.paths.index) || existsSync(`${this.paths.index}.backup`)) {
      await this.reconcileIndex(await this.readIndex());
      return;
    }

    const index = createEmptyLibraryIndex();
    if (existsSync(this.paths.legacyDocument) || existsSync(`${this.paths.legacyDocument}.backup`)) {
      let document = await this.readDocument(this.paths.legacyDocument);
      if (!document.name.trim() || document.name.trim() === "새 이력서") {
        document = { ...document, name: "내 이력서" };
      }
      assertSafeId(document.documentId);
      const destination = this.paths.activeDocument(document.documentId);
      if (!existsSync(destination)) await this.writeDocument(destination, document);
      else document = await this.readDocument(destination);
      const createdAt = await fileTimestamp(this.paths.legacyDocument, document.updatedAt);
      index.resumes.push(summaryFromDocument(document, createdAt));
    }
    await this.writeIndex(index);
  }

  private async reconcileIndex(index: DocumentLibraryIndex): Promise<DocumentLibraryIndex> {
    const activeById = new Map(index.resumes.map((item) => [item.id, item]));
    const trashById = new Map(index.trash.map((item) => [item.id, item]));
    const resumes: DocumentSummary[] = [];
    const trash: DeletedDocumentSummary[] = [];

    for (const id of await this.documentIdsIn(this.paths.activeDirectory)) {
      const existing = activeById.get(id);
      try {
        const path = this.paths.activeDocument(id);
        const document = await this.readDocument(path);
        if (document.documentId !== id) continue;
        const createdAt = existing?.createdAt ?? await fileTimestamp(path, document.updatedAt);
        resumes.push(summaryFromDocument(document, createdAt));
      } catch {
        if (existing) resumes.push(existing);
      }
    }

    for (const id of await this.documentIdsIn(this.paths.trashDirectory)) {
      const existing = trashById.get(id);
      try {
        const path = this.paths.trashDocument(id);
        const document = await this.readDocument(path);
        if (document.documentId !== id) continue;
        const createdAt = existing?.createdAt ?? await fileTimestamp(path, document.updatedAt);
        const deletedAt = existing?.deletedAt ?? await fileModifiedTimestamp(path, document.updatedAt);
        trash.push({ ...summaryFromDocument(document, createdAt), deletedAt });
      } catch {
        if (existing) trash.push(existing);
      }
    }

    const next: DocumentLibraryIndex = {
      ...index,
      resumes: sortDocumentSummaries(resumes),
      trash: sortDeletedDocumentSummaries(trash),
    };
    if (JSON.stringify(next) !== JSON.stringify(index)) await this.writeIndex(next);
    return next;
  }

  private async documentIdsIn(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(DOCUMENT_SUFFIX))
      .map((entry) => entry.name.slice(0, -DOCUMENT_SUFFIX.length))
      .filter(isSafeId);
  }

  private async readIndex(): Promise<DocumentLibraryIndex> {
    return readJsonWithBackup(
      this.paths.index,
      (value) => {
        if (!isDocumentLibraryIndex(value)) {
          throw new Error("이력서 목록 형식이 올바르지 않습니다.");
        }
        return value;
      },
      "이력서 목록 파일을 찾을 수 없습니다.",
    );
  }

  private async writeIndex(index: DocumentLibraryIndex): Promise<void> {
    await writeJsonAtomically(
      this.paths.index,
      index,
      (current) => isDocumentLibraryIndex(current)
        ? { path: `${this.paths.index}.backup`, overwrite: true }
        : undefined,
    );
  }

  private async readDocument(path: string): Promise<WorkspaceDocument> {
    return readJsonWithBackup(
      path,
      migrateStoredDocument,
      "이력서 파일을 찾을 수 없습니다.",
    );
  }

  private async writeDocument(path: string, document: WorkspaceDocument): Promise<void> {
    if (!isWorkspaceDocument(document)) {
      throw new Error("저장할 이력서의 데이터 형식이 올바르지 않습니다.");
    }
    await writeJsonAtomically(path, document, (current) => {
      if (isWorkspaceDocument(current)) {
        return { path: `${path}.backup`, overwrite: true };
      }
      if (isV1WorkspaceDocument(current)) {
        return { path: `${path}.v1.backup`, overwrite: false };
      }
      return undefined;
    });
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(() => undefined, () => undefined);
    return result;
  }
}

function isSafeId(id: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id);
}

function assertSafeId(id: string): void {
  if (!isSafeId(id)) throw new Error("이력서 ID 형식이 올바르지 않습니다.");
}

async function fileTimestamp(path: string, fallback: string): Promise<string> {
  try {
    const details = await stat(path);
    const timestamp = details.birthtimeMs > 0 ? details.birthtime : details.mtime;
    return timestamp.toISOString();
  } catch {
    return fallback;
  }
}

async function fileModifiedTimestamp(path: string, fallback: string): Promise<string> {
  try {
    return (await stat(path)).mtime.toISOString();
  } catch {
    return fallback;
  }
}
