import { existsSync } from "node:fs";
import { mkdir, readdir, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createEmptyDocument } from "../../foundation/documentModel.ts";
import { importComponentPackage } from "../../foundation/documentComponentOperations.ts";
import {
  COMPONENT_LIBRARY_SCHEMA_VERSION,
  createEmptyComponentLibraryIndex,
  isComponentLibraryIndex,
  isComponentLibraryItem,
  sortComponentSummaries,
  type ComponentLibraryIndex,
  type ComponentLibraryItem,
  type ComponentLibraryPackageInput,
  type ComponentLibrarySummary,
} from "../../foundation/componentLibrary.ts";
import { readJsonWithBackup, writeJsonAtomically } from "./atomicJsonStore.ts";
import { COMPONENT_SUFFIX, createDocumentPaths, type DocumentPaths } from "./documentPaths.ts";

export class ComponentLibraryRepository {
  private operationQueue: Promise<void> = Promise.resolve();
  private initializationPromise: Promise<void> | undefined;
  private readonly paths: DocumentPaths;

  constructor(workspaceDirectory: string) {
    this.paths = createDocumentPaths(workspaceDirectory);
  }

  list(): Promise<ComponentLibrarySummary[]> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      return sortComponentSummaries((await this.reconcileIndex(await this.readIndex())).items);
    });
  }

  save(input: ComponentLibraryPackageInput): Promise<ComponentLibrarySummary> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      const now = new Date().toISOString();
      const id = input.id ?? `component-${randomUUID()}`;
      assertSafeId(id);
      const existing = input.id ? await this.readItem(id) : undefined;
      const item: ComponentLibraryItem = {
        schemaVersion: COMPONENT_LIBRARY_SCHEMA_VERSION,
        id,
        name: input.name.trim() || input.package.name.trim() || "이름 없는 컴포넌트",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        package: structuredClone(input.package),
      };
      if (!isComponentLibraryItem(item)) throw new Error("저장할 컴포넌트 형식이 올바르지 않습니다.");
      assertValidComponentItem(item);
      await this.writeItem(item);
      const index = await this.readIndex();
      const summary = summaryFromItem(item);
      await this.writeIndex({
        ...index,
        items: sortComponentSummaries([
          ...index.items.filter((entry) => entry.id !== summary.id),
          summary,
        ]),
      });
      return summary;
    });
  }

  load(id: string): Promise<ComponentLibraryItem> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      assertSafeId(id);
      if (!(await this.readIndex()).items.some((item) => item.id === id)) {
        throw new Error("컴포넌트 라이브러리에서 항목을 찾을 수 없습니다.");
      }
      return this.readItem(id);
    });
  }

  remove(id: string): Promise<void> {
    return this.enqueue(async () => {
      await this.ensureInitialized();
      assertSafeId(id);
      const index = await this.readIndex();
      if (!index.items.some((item) => item.id === id)) {
        throw new Error("삭제할 컴포넌트를 찾을 수 없습니다.");
      }
      const path = this.paths.componentItem(id);
      await this.writeIndex({ ...index, items: index.items.filter((item) => item.id !== id) });
      try {
        if (existsSync(`${path}.backup`)) await unlink(`${path}.backup`);
        await unlink(path);
      } catch (error) {
        await this.writeIndex(index).catch(() => undefined);
        throw error;
      }
    });
  }

  private ensureInitialized(): Promise<void> {
    this.initializationPromise ??= this.initialize();
    return this.initializationPromise;
  }

  private async initialize(): Promise<void> {
    await mkdir(this.paths.componentDirectory, { recursive: true });
    if (!existsSync(this.paths.componentIndex) && !existsSync(`${this.paths.componentIndex}.backup`)) {
      await this.writeIndex(createEmptyComponentLibraryIndex());
    }
    await this.reconcileIndex(await this.readIndex());
  }

  private async reconcileIndex(index: ComponentLibraryIndex): Promise<ComponentLibraryIndex> {
    const existing = new Map(index.items.map((item) => [item.id, item]));
    const items: ComponentLibrarySummary[] = [];
    const entries = await readdir(this.paths.componentDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(COMPONENT_SUFFIX)) continue;
      const id = entry.name.slice(0, -COMPONENT_SUFFIX.length);
      if (!isSafeId(id)) continue;
      try {
        const item = await this.readItem(id);
        if (item.id === id) items.push(summaryFromItem(item));
      } catch {
        const summary = existing.get(id);
        if (summary) items.push(summary);
      }
    }
    const next = { ...index, items: sortComponentSummaries(items) };
    if (JSON.stringify(next) !== JSON.stringify(index)) await this.writeIndex(next);
    return next;
  }

  private readIndex(): Promise<ComponentLibraryIndex> {
    return readJsonWithBackup(this.paths.componentIndex, (value) => {
      if (!isComponentLibraryIndex(value)) throw new Error("컴포넌트 목록 형식이 올바르지 않습니다.");
      return value;
    }, "컴포넌트 목록 파일을 찾을 수 없습니다.");
  }

  private writeIndex(index: ComponentLibraryIndex): Promise<void> {
    return writeJsonAtomically(this.paths.componentIndex, index, (current) => isComponentLibraryIndex(current)
      ? { path: `${this.paths.componentIndex}.backup`, overwrite: true }
      : undefined);
  }

  private readItem(id: string): Promise<ComponentLibraryItem> {
    return readJsonWithBackup(this.paths.componentItem(id), (value) => {
      if (!isComponentLibraryItem(value)) throw new Error("컴포넌트 항목 형식이 올바르지 않습니다.");
      assertValidComponentItem(value);
      return value;
    }, "컴포넌트 항목 파일을 찾을 수 없습니다.");
  }

  private writeItem(item: ComponentLibraryItem): Promise<void> {
    return writeJsonAtomically(this.paths.componentItem(item.id), item, (current) => isComponentLibraryItem(current)
      ? { path: `${this.paths.componentItem(item.id)}.backup`, overwrite: true }
      : undefined);
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(() => undefined, () => undefined);
    return result;
  }
}

function summaryFromItem(item: ComponentLibraryItem): ComponentLibrarySummary {
  return {
    id: item.id,
    name: item.name,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function isSafeId(id: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id);
}

function assertSafeId(id: string): void {
  if (!isSafeId(id)) throw new Error("컴포넌트 ID 형식이 올바르지 않습니다.");
}

function assertValidComponentItem(item: ComponentLibraryItem): void {
  try {
    importComponentPackage(createEmptyDocument(), item.package);
  } catch (error) {
    throw new Error(`컴포넌트 package가 올바르지 않습니다: ${errorMessage(error)}`);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
