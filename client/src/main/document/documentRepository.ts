import { existsSync } from "node:fs";
import { mkdir, readdir, rename, stat, unlink } from "node:fs/promises";
import {
  createEmptyDocument,
  isDocumentData,
  type DocumentData,
} from "../../foundation/document.ts";
import {
  createEmptyLibraryIndex,
  DEFAULT_DOCUMENT_NAME,
  isDocumentLibraryIndex,
  normalizeDocumentName,
  sortDeletedDocumentSummaries,
  sortDocumentSummaries,
  summaryFromDocument,
  type DeletedDocumentSummary,
  type DocumentLibraryIndex,
  type DocumentSummary,
} from "../../foundation/documentLibrary.ts";
import { readJsonWithBackup, writeJsonAtomically } from "./atomicJsonStore.ts";
import {
  createDocumentPaths,
  DOCUMENT_BACKUP_SUFFIXES,
  DOCUMENT_SUFFIX,
  type DocumentPaths,
} from "./documentPaths.ts";
import { importLegacyDocument } from "./legacy/importLegacyDocument.ts";
import { upgradeLegacyImportedDocument } from "./legacy/upgradeLegacyImportedDocument.ts";
import {
  createLegacyDocumentPaths,
  LEGACY_DOCUMENT_SUFFIX,
  type LegacyDocumentPaths,
} from "./legacy/legacyPaths.ts";

type LegacyMigrationMarker = {
  schemaVersion: 1;
  completedAt: string;
};

export class DocumentRepository {
  private operationQueue: Promise<void> = Promise.resolve();
  private initializationPromise: Promise<void> | undefined;
  private readonly paths: DocumentPaths;
  private readonly legacyPaths: LegacyDocumentPaths;

  constructor(workspaceDirectory: string) {
    this.paths = createDocumentPaths(workspaceDirectory);
    this.legacyPaths = createLegacyDocumentPaths(workspaceDirectory);
  }

  list(): Promise<DocumentSummary[]> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      return sortDocumentSummaries((await this.reconcileIndex(await this.readIndex())).documents);
    });
  }

  listTrash(): Promise<DeletedDocumentSummary[]> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      return sortDeletedDocumentSummaries((await this.reconcileIndex(await this.readIndex())).trash);
    });
  }

  create(): Promise<{ summary: DocumentSummary; document: DocumentData }> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      const createdAt = new Date().toISOString();
      const document = createEmptyDocument({ name: DEFAULT_DOCUMENT_NAME, now: createdAt });
      assertSafeId(document.documentId);
      await this.writeDocument(this.paths.activeDocument(document.documentId), document);
      const index = await this.readIndex();
      const summary = summaryFromDocument(document, createdAt);
      await this.writeIndex({
        ...index,
        documents: sortDocumentSummaries([
          ...index.documents.filter((item) => item.id !== summary.id),
          summary,
        ]),
      });
      return { summary, document };
    });
  }

  load(id: string): Promise<DocumentData> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      assertSafeId(id);
      const index = await this.readIndex();
      if (!index.documents.some((item) => item.id === id)) {
        throw new Error("요청한 문서를 목록에서 찾을 수 없습니다.");
      }
      const document = await this.readDocument(this.paths.activeDocument(id));
      if (document.documentId !== id) throw new Error("문서 ID와 저장 파일이 일치하지 않습니다.");
      return await this.upgradeLegacyVisuals(id, document);
    });
  }

  save(id: string, document: DocumentData): Promise<DocumentSummary> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      return this.saveInside(id, document);
    });
  }

  rename(id: string, name: string): Promise<DocumentSummary> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      assertSafeId(id);
      const document = await this.readDocument(this.paths.activeDocument(id));
      return this.saveInside(id, { ...document, name: normalizeDocumentName(name) });
    });
  }

  remove(id: string): Promise<void> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      assertSafeId(id);
      const index = await this.readIndex();
      const summary = index.documents.find((item) => item.id === id);
      if (!summary) throw new Error("삭제할 문서를 찾을 수 없습니다.");

      const source = this.paths.activeDocument(id);
      const destination = this.paths.trashDocument(id);
      if (!existsSync(source)) throw new Error("삭제할 문서 파일을 찾을 수 없습니다.");
      assertDestinationAvailable(destination, "휴지통에 같은 ID의 문서가 이미 있습니다.");

      await rename(source, destination);
      const movedBackups: string[] = [];
      try {
        for (const suffix of DOCUMENT_BACKUP_SUFFIXES) {
          if (!existsSync(`${source}${suffix}`)) continue;
          await rename(`${source}${suffix}`, `${destination}${suffix}`);
          movedBackups.push(suffix);
        }
        await this.writeIndex({
          ...index,
          documents: index.documents.filter((item) => item.id !== id),
          trash: sortDeletedDocumentSummaries([
            ...index.trash.filter((item) => item.id !== id),
            { ...summary, deletedAt: new Date().toISOString() },
          ]),
        });
      } catch (error) {
        await rollbackMove(source, destination, movedBackups);
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
      if (!deleted) throw new Error("복원할 문서를 휴지통에서 찾을 수 없습니다.");
      if (index.documents.some((item) => item.id === id)) {
        throw new Error("같은 ID의 문서가 목록에 있어 복원할 수 없습니다.");
      }

      const source = this.paths.trashDocument(id);
      const destination = this.paths.activeDocument(id);
      if (!existsSync(source)) throw new Error("복원할 문서 파일을 찾을 수 없습니다.");
      assertDestinationAvailable(destination, "같은 ID의 문서 파일이 있어 덮어쓰지 않았습니다.");

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
          documents: sortDocumentSummaries([...index.documents, summary]),
          trash: index.trash.filter((item) => item.id !== id),
        });
        return summary;
      } catch (error) {
        await rollbackMove(source, destination, movedBackups);
        throw error;
      }
    });
  }

  permanentlyDelete(id: string): Promise<void> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      assertSafeId(id);
      const index = await this.readIndex();
      if (!index.trash.some((item) => item.id === id)) {
        throw new Error("완전히 삭제할 문서를 휴지통에서 찾을 수 없습니다.");
      }
      const path = this.paths.trashDocument(id);
      if (!existsSync(path)) throw new Error("완전히 삭제할 문서 파일을 찾을 수 없습니다.");
      await this.writeIndex({ ...index, trash: index.trash.filter((item) => item.id !== id) });
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

  private async saveInside(id: string, document: DocumentData): Promise<DocumentSummary> {
    assertSafeId(id);
    if (!isDocumentData(document)) throw new Error("저장할 문서의 데이터 형식이 올바르지 않습니다.");
    if (document.documentId !== id) throw new Error("요청한 문서 ID와 문서 ID가 일치하지 않습니다.");
    const index = await this.readIndex();
    const current = index.documents.find((item) => item.id === id);
    if (!current) throw new Error("저장할 문서를 목록에서 찾을 수 없습니다.");

    const nextDocument = {
      ...document,
      name: normalizeDocumentName(document.name),
      updatedAt: new Date().toISOString(),
    };
    await this.writeDocument(this.paths.activeDocument(id), nextDocument);
    const summary = summaryFromDocument(nextDocument, current.createdAt);
    await this.writeIndex({
      ...index,
      documents: sortDocumentSummaries(index.documents.map((item) => item.id === id ? summary : item)),
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
    if (!existsSync(this.paths.index) && !existsSync(`${this.paths.index}.backup`)) {
      await this.writeIndex(createEmptyLibraryIndex());
    }
    if (!existsSync(this.legacyPaths.migrationMarker) && !existsSync(`${this.legacyPaths.migrationMarker}.backup`)) {
      await this.migrateLegacyDocuments();
    }
    await this.reconcileIndex(await this.readIndex());
  }

  private async migrateLegacyDocuments(): Promise<void> {
    const index = await this.readIndex();
    const documents = new Map(index.documents.map((item) => [item.id, item]));
    for (const source of await this.legacyDocumentPaths()) {
      const imported = await readJsonWithBackup(
        source,
        importLegacyDocument,
        "이전 문서 파일을 찾을 수 없습니다.",
      );
      assertSafeId(imported.documentId);
      const destination = this.paths.activeDocument(imported.documentId);
      const document = existsSync(destination) ? await this.readDocument(destination) : imported;
      if (!existsSync(destination)) await this.writeDocument(destination, document);
      const createdAt = documents.get(document.documentId)?.createdAt ??
        await fileTimestamp(source, document.updatedAt);
      documents.set(document.documentId, summaryFromDocument(document, createdAt));
    }
    await this.writeIndex({ ...index, documents: sortDocumentSummaries([...documents.values()]) });
    await writeJsonAtomically<LegacyMigrationMarker>(
      this.legacyPaths.migrationMarker,
      { schemaVersion: 1, completedAt: new Date().toISOString() },
      (current) => isMigrationMarker(current)
        ? { path: `${this.legacyPaths.migrationMarker}.backup`, overwrite: true }
        : undefined,
    );
  }

  private async legacyDocumentPaths(): Promise<string[]> {
    const paths: string[] = [];
    if (existsSync(this.legacyPaths.singleDocument) || existsSync(`${this.legacyPaths.singleDocument}.backup`)) {
      paths.push(this.legacyPaths.singleDocument);
    }
    if (existsSync(this.legacyPaths.activeDirectory)) {
      const entries = await readdir(this.legacyPaths.activeDirectory, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(LEGACY_DOCUMENT_SUFFIX)) {
          paths.push(this.legacyPaths.activeDocument(entry.name.slice(0, -LEGACY_DOCUMENT_SUFFIX.length)));
        }
      }
    }
    return [...new Set(paths)].sort();
  }

  private async upgradeLegacyVisuals(id: string, document: DocumentData): Promise<DocumentData> {
    for (const source of await this.legacyDocumentPaths()) {
      try {
        const imported = await readJsonWithBackup(
          source,
          importLegacyDocument,
          "이전 문서 파일을 찾을 수 없습니다.",
        );
        if (imported.documentId === id) return upgradeLegacyImportedDocument(document, imported);
      } catch {
        // 현재 범용 문서는 legacy 원본을 읽을 수 없어도 그대로 열 수 있어야 한다.
      }
    }
    return document;
  }

  private async reconcileIndex(index: DocumentLibraryIndex): Promise<DocumentLibraryIndex> {
    const activeById = new Map(index.documents.map((item) => [item.id, item]));
    const trashById = new Map(index.trash.map((item) => [item.id, item]));
    const documents: DocumentSummary[] = [];
    const trash: DeletedDocumentSummary[] = [];

    for (const id of await this.documentIdsIn(this.paths.activeDirectory)) {
      const existing = activeById.get(id);
      try {
        const path = this.paths.activeDocument(id);
        const document = await this.readDocument(path);
        if (document.documentId !== id) continue;
        documents.push(summaryFromDocument(
          document,
          existing?.createdAt ?? await fileTimestamp(path, document.updatedAt),
        ));
      } catch {
        if (existing) documents.push(existing);
      }
    }

    for (const id of await this.documentIdsIn(this.paths.trashDirectory)) {
      const existing = trashById.get(id);
      try {
        const path = this.paths.trashDocument(id);
        const document = await this.readDocument(path);
        if (document.documentId !== id) continue;
        trash.push({
          ...summaryFromDocument(document, existing?.createdAt ?? await fileTimestamp(path, document.updatedAt)),
          deletedAt: existing?.deletedAt ?? await fileModifiedTimestamp(path, document.updatedAt),
        });
      } catch {
        if (existing) trash.push(existing);
      }
    }

    const next = {
      ...index,
      documents: sortDocumentSummaries(documents),
      trash: sortDeletedDocumentSummaries(trash),
    };
    if (JSON.stringify(next) !== JSON.stringify(index)) await this.writeIndex(next);
    return next;
  }

  private async documentIdsIn(directory: string): Promise<string[]> {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(DOCUMENT_SUFFIX))
      .map((entry) => entry.name.slice(0, -DOCUMENT_SUFFIX.length))
      .filter(isSafeId);
  }

  private readIndex(): Promise<DocumentLibraryIndex> {
    return readJsonWithBackup(
      this.paths.index,
      (value) => {
        if (!isDocumentLibraryIndex(value)) throw new Error("문서 목록 형식이 올바르지 않습니다.");
        return value;
      },
      "문서 목록 파일을 찾을 수 없습니다.",
    );
  }

  private writeIndex(index: DocumentLibraryIndex): Promise<void> {
    return writeJsonAtomically(this.paths.index, index, (current) => isDocumentLibraryIndex(current)
      ? { path: `${this.paths.index}.backup`, overwrite: true }
      : undefined);
  }

  private readDocument(path: string): Promise<DocumentData> {
    return readJsonWithBackup(path, (value) => {
      if (!isDocumentData(value)) throw new Error("문서 데이터 형식이 올바르지 않습니다.");
      return value;
    }, "문서 파일을 찾을 수 없습니다.");
  }

  private writeDocument(path: string, document: DocumentData): Promise<void> {
    if (!isDocumentData(document)) return Promise.reject(new Error("저장할 문서의 데이터 형식이 올바르지 않습니다."));
    return writeJsonAtomically(path, document, (current) => isDocumentData(current)
      ? { path: `${path}.backup`, overwrite: true }
      : undefined);
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
  if (!isSafeId(id)) throw new Error("문서 ID 형식이 올바르지 않습니다.");
}

function assertDestinationAvailable(path: string, message: string): void {
  if (existsSync(path) || DOCUMENT_BACKUP_SUFFIXES.some((suffix) => existsSync(`${path}${suffix}`))) {
    throw new Error(message);
  }
}

async function rollbackMove(source: string, destination: string, suffixes: string[]): Promise<void> {
  for (const suffix of suffixes.reverse()) {
    if (existsSync(`${destination}${suffix}`)) {
      await rename(`${destination}${suffix}`, `${source}${suffix}`).catch(() => undefined);
    }
  }
  if (existsSync(destination)) await rename(destination, source).catch(() => undefined);
}

function isMigrationMarker(value: unknown): value is LegacyMigrationMarker {
  return typeof value === "object" && value !== null &&
    (value as LegacyMigrationMarker).schemaVersion === 1 &&
    typeof (value as LegacyMigrationMarker).completedAt === "string";
}

async function fileTimestamp(path: string, fallback: string): Promise<string> {
  try {
    const details = await stat(path);
    return (details.birthtimeMs > 0 ? details.birthtime : details.mtime).toISOString();
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
