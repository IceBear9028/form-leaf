import { existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  createDefaultDocument,
  isResumeDocument,
  isV1ResumeDocument,
  type ResumeDocument,
} from "../shared/resume.ts";
import {
  createEmptyLibraryIndex,
  DEFAULT_RESUME_TITLE,
  isResumeLibraryIndex,
  normalizeResumeTitle,
  sortDeletedResumeSummaries,
  sortResumeSummaries,
  summaryFromDocument,
  type DeletedResumeSummary,
  type ResumeLibraryIndex,
  type ResumeSummary,
} from "../shared/resumeLibrary.ts";
import { migrateResumeDocumentV1 } from "../shared/resumeMigration.ts";

const DOCUMENT_SUFFIX = ".resume.json";
const DOCUMENT_BACKUP_SUFFIXES = [".backup", ".v1.backup"] as const;

export class ResumeRepository {
  private operationQueue: Promise<void> = Promise.resolve();
  private initializationPromise: Promise<void> | undefined;
  private readonly workspaceDirectory: string;

  constructor(workspaceDirectory: string) {
    this.workspaceDirectory = workspaceDirectory;
  }

  list(): Promise<ResumeSummary[]> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      const index = await this.reconcileIndex(await this.readIndex());
      return sortResumeSummaries(index.resumes);
    });
  }

  listTrash(): Promise<DeletedResumeSummary[]> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      const index = await this.reconcileIndex(await this.readIndex());
      return sortDeletedResumeSummaries(index.trash);
    });
  }

  create(): Promise<{ summary: ResumeSummary; document: ResumeDocument }> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      const createdAt = new Date().toISOString();
      const document: ResumeDocument = {
        ...createDefaultDocument(),
        name: DEFAULT_RESUME_TITLE,
        updatedAt: createdAt,
      };
      assertSafeId(document.documentId);
      await this.writeDocument(this.resumePath(document.documentId), document);

      const index = await this.readIndex();
      const summary = summaryFromDocument(document, createdAt);
      await this.writeIndex({
        ...index,
        resumes: sortResumeSummaries([
          ...index.resumes.filter((item) => item.id !== summary.id),
          summary,
        ]),
      });
      return { summary, document };
    });
  }

  load(id: string): Promise<ResumeDocument> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      assertSafeId(id);
      const index = await this.readIndex();
      if (!index.resumes.some((item) => item.id === id)) {
        throw new Error("요청한 이력서를 목록에서 찾을 수 없습니다.");
      }
      const document = await this.readDocument(this.resumePath(id));
      if (document.documentId !== id) {
        throw new Error("이력서 ID와 저장 파일이 일치하지 않습니다.");
      }
      return document;
    });
  }

  save(id: string, document: ResumeDocument): Promise<ResumeSummary> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      return this.saveInside(id, document);
    });
  }

  rename(id: string, title: string): Promise<ResumeSummary> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      assertSafeId(id);
      const document = await this.readDocument(this.resumePath(id));
      return this.saveInside(id, {
        ...document,
        name: normalizeResumeTitle(title),
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

      const source = this.resumePath(id);
      const destination = this.trashPath(id);
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
        const deleted: DeletedResumeSummary = {
          ...summary,
          deletedAt: new Date().toISOString(),
        };
        await this.writeIndex({
          ...index,
          resumes: index.resumes.filter((item) => item.id !== id),
          trash: sortDeletedResumeSummaries([
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

  restore(id: string): Promise<ResumeSummary> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      assertSafeId(id);
      const index = await this.readIndex();
      const deleted = index.trash.find((item) => item.id === id);
      if (!deleted) throw new Error("복원할 이력서를 휴지통에서 찾을 수 없습니다.");
      if (index.resumes.some((item) => item.id === id)) {
        throw new Error("같은 ID의 이력서가 목록에 있어 복원할 수 없습니다.");
      }

      const source = this.trashPath(id);
      const destination = this.resumePath(id);
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
          resumes: sortResumeSummaries([...index.resumes, summary]),
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

      const path = this.trashPath(id);
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

  private async saveInside(id: string, document: ResumeDocument): Promise<ResumeSummary> {
    assertSafeId(id);
    if (!isResumeDocument(document)) {
      throw new Error("저장할 이력서의 데이터 형식이 올바르지 않습니다.");
    }
    if (document.documentId !== id) {
      throw new Error("요청한 이력서 ID와 문서 ID가 일치하지 않습니다.");
    }

    const index = await this.readIndex();
    const currentSummary = index.resumes.find((item) => item.id === id);
    if (!currentSummary) throw new Error("저장할 이력서를 목록에서 찾을 수 없습니다.");

    const updatedAt = new Date().toISOString();
    const nextDocument: ResumeDocument = {
      ...document,
      name: normalizeResumeTitle(document.name),
      updatedAt,
    };
    await this.writeDocument(this.resumePath(id), nextDocument);
    const summary = summaryFromDocument(nextDocument, currentSummary.createdAt);
    await this.writeIndex({
      ...index,
      resumes: sortResumeSummaries(index.resumes.map((item) =>
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
    await mkdir(this.resumesDirectory, { recursive: true });
    await mkdir(this.trashDirectory, { recursive: true });

    if (existsSync(this.indexPath) || existsSync(`${this.indexPath}.backup`)) {
      await this.reconcileIndex(await this.readIndex());
      return;
    }

    const index = createEmptyLibraryIndex();
    if (existsSync(this.legacyPath) || existsSync(`${this.legacyPath}.backup`)) {
      let document = await this.readDocument(this.legacyPath);
      if (!document.name.trim() || document.name.trim() === "새 이력서") {
        document = { ...document, name: "내 이력서" };
      }
      assertSafeId(document.documentId);
      const destination = this.resumePath(document.documentId);
      if (!existsSync(destination)) await this.writeDocument(destination, document);
      else document = await this.readDocument(destination);
      const createdAt = await fileTimestamp(this.legacyPath, document.updatedAt);
      index.resumes.push(summaryFromDocument(document, createdAt));
    }
    await this.writeIndex(index);
  }

  private async reconcileIndex(index: ResumeLibraryIndex): Promise<ResumeLibraryIndex> {
    const activeById = new Map(index.resumes.map((item) => [item.id, item]));
    const trashById = new Map(index.trash.map((item) => [item.id, item]));
    const resumes: ResumeSummary[] = [];
    const trash: DeletedResumeSummary[] = [];

    for (const id of await this.documentIdsIn(this.resumesDirectory)) {
      const existing = activeById.get(id);
      try {
        const path = this.resumePath(id);
        const document = await this.readDocument(path);
        if (document.documentId !== id) continue;
        const createdAt = existing?.createdAt ?? await fileTimestamp(path, document.updatedAt);
        resumes.push(summaryFromDocument(document, createdAt));
      } catch {
        if (existing) resumes.push(existing);
      }
    }

    for (const id of await this.documentIdsIn(this.trashDirectory)) {
      const existing = trashById.get(id);
      try {
        const path = this.trashPath(id);
        const document = await this.readDocument(path);
        if (document.documentId !== id) continue;
        const createdAt = existing?.createdAt ?? await fileTimestamp(path, document.updatedAt);
        const deletedAt = existing?.deletedAt ?? await fileModifiedTimestamp(path, document.updatedAt);
        trash.push({ ...summaryFromDocument(document, createdAt), deletedAt });
      } catch {
        if (existing) trash.push(existing);
      }
    }

    const next: ResumeLibraryIndex = {
      ...index,
      resumes: sortResumeSummaries(resumes),
      trash: sortDeletedResumeSummaries(trash),
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

  private async readIndex(): Promise<ResumeLibraryIndex> {
    const candidates = [this.indexPath, `${this.indexPath}.backup`];
    let firstError: unknown;
    for (const path of candidates) {
      if (!existsSync(path)) continue;
      try {
        const value: unknown = JSON.parse(await readFile(path, "utf8"));
        if (!isResumeLibraryIndex(value)) throw new Error("이력서 목록 형식이 올바르지 않습니다.");
        return value;
      } catch (error) {
        firstError ??= error;
      }
    }
    throw firstError ?? new Error("이력서 목록 파일을 찾을 수 없습니다.");
  }

  private async writeIndex(index: ResumeLibraryIndex): Promise<void> {
    await writeJsonAtomically(this.indexPath, index, isResumeLibraryIndex);
  }

  private async readDocument(path: string): Promise<ResumeDocument> {
    const candidates = [path, `${path}.backup`];
    let firstError: unknown;
    for (const candidate of candidates) {
      if (!existsSync(candidate)) continue;
      try {
        const value: unknown = JSON.parse(await readFile(candidate, "utf8"));
        return normalizeStoredDocument(value);
      } catch (error) {
        firstError ??= error;
      }
    }
    throw firstError ?? new Error("이력서 파일을 찾을 수 없습니다.");
  }

  private async writeDocument(path: string, document: ResumeDocument): Promise<void> {
    if (!isResumeDocument(document)) {
      throw new Error("저장할 이력서의 데이터 형식이 올바르지 않습니다.");
    }
    await mkdir(dirname(path), { recursive: true });
    if (existsSync(path)) {
      try {
        const current: unknown = JSON.parse(await readFile(path, "utf8"));
        if (isResumeDocument(current)) {
          await copyFile(path, `${path}.backup`);
        } else if (isV1ResumeDocument(current)) {
          const v1BackupPath = `${path}.v1.backup`;
          if (!existsSync(v1BackupPath)) await copyFile(path, v1BackupPath);
        }
      } catch {
        // 손상된 현재 파일로 정상 백업을 덮어쓰지 않는다.
      }
    }
    await writeTextAtomically(path, `${JSON.stringify(document, null, 2)}\n`);
  }

  private resumePath(id: string): string {
    return join(this.resumesDirectory, `${id}${DOCUMENT_SUFFIX}`);
  }

  private trashPath(id: string): string {
    return join(this.trashDirectory, `${id}${DOCUMENT_SUFFIX}`);
  }

  private get indexPath(): string {
    return join(this.workspaceDirectory, "library.json");
  }

  private get legacyPath(): string {
    return join(this.workspaceDirectory, "default.resume.json");
  }

  private get resumesDirectory(): string {
    return join(this.workspaceDirectory, "resumes");
  }

  private get trashDirectory(): string {
    return join(this.workspaceDirectory, "trash");
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(() => undefined, () => undefined);
    return result;
  }
}

function normalizeStoredDocument(value: unknown): ResumeDocument {
  if (isResumeDocument(value)) return value;
  if (isV1ResumeDocument(value)) return migrateResumeDocumentV1(value);
  throw new Error("저장된 이력서의 데이터 형식이 올바르지 않습니다.");
}

function isSafeId(id: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id);
}

function assertSafeId(id: string): void {
  if (!isSafeId(id)) throw new Error("이력서 ID 형식이 올바르지 않습니다.");
}

async function writeJsonAtomically<T>(
  path: string,
  value: T,
  validator: (current: unknown) => boolean,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  if (existsSync(path)) {
    try {
      const current: unknown = JSON.parse(await readFile(path, "utf8"));
      if (validator(current)) await copyFile(path, `${path}.backup`);
    } catch {
      // 손상된 현재 파일로 정상 백업을 덮어쓰지 않는다.
    }
  }
  await writeTextAtomically(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeTextAtomically(path: string, value: string): Promise<void> {
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, value, "utf8");
  await rename(temporaryPath, path);
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
