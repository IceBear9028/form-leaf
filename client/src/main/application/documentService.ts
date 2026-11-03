import { randomUUID } from "node:crypto";
import { createEmptyDocument, isDocumentData, type DocumentData } from "../../foundation/document.ts";
import { DEFAULT_DOCUMENT_NAME, normalizeDocumentName, type DocumentSummary } from "../../foundation/documentLibrary.ts";
import { CommandFailure, failure, type ApplyResult, type Changes, type CreateResult, type OperationResult, type JournalResult } from "../../foundation/documentCommands.ts";
import type { SavedDocument, SaveDocumentResult } from "../../foundation/documentSessionProtocol.ts";
import type { DocumentRepository } from "../document/documentRepository.ts";
import type { ComponentLibraryRepository } from "../document/componentLibraryRepository.ts";
import type { ComponentLibraryPackageInput } from "../../foundation/componentLibrary.ts";
import { documentRevision, requestHash } from "./documentRevision.ts";
import { EditorCoordinator } from "./editorCoordinator.ts";
import { OperationJournal, type JournalEntry } from "./operationJournal.ts";

export type Mutation = { document: DocumentData; changes: Changes; results: OperationResult[]; warnings: string[] };
export type MutationIdentity = { credentialId: string; requestId: string; hash: string };
type Authorize = () => void | Promise<void>;
type FaultPoint = "prepared" | "document-saved" | "grant-saved" | "completed";

/** All production writers (UI, document management, library and MCP) share this queue. */
export class DocumentService {
  private queue: Promise<unknown> = Promise.resolve();
  private initialization?: Promise<void>;
  private blocked = new Set<string>();
  readonly journal: OperationJournal;
  readonly coordinator: EditorCoordinator;
  private grantCreated: (credentialId: string, documentId: string) => Promise<void> = async () => undefined;
  private fault?: (point: FaultPoint) => void;
  private readonly repository: DocumentRepository;
  private readonly components: ComponentLibraryRepository;
  constructor(
    repository: DocumentRepository,
    components: ComponentLibraryRepository,
    workspace: string,
    options: { coordinator?: EditorCoordinator; fault?: (point: FaultPoint) => void } = {},
  ) {
    this.repository = repository; this.components = components;
    this.journal = new OperationJournal(workspace);
    this.coordinator = options.coordinator ?? new EditorCoordinator();
    this.fault = options.fault;
  }
  setCreatedGrantHandler(handler: (credentialId: string, documentId: string) => Promise<void>): void { this.grantCreated = handler; }
  initialize(): Promise<void> {
    this.initialization ??= this.recover();
    return this.initialization;
  }
  private async recover(): Promise<void> {
    await Promise.all([this.repository.initialize(), this.components.initialize()]);
    for (const entry of await this.journal.list()) {
      if (entry.response.status !== "pending" && entry.response.status !== "recovery_required") continue;
      try {
        const snapshot = await this.journal.snapshot(entry);
        await this.repository.commitSnapshot(snapshot, entry.previousRevision);
        if (entry.created && entry.credentialId !== "ui") await this.grantCreated(entry.credentialId, entry.documentId);
        const result = entry.response.result;
        if (!result) failure("OPERATION_RECOVERY_REQUIRED", "작업 완료 정보를 복구할 수 없습니다.");
        await this.journal.finish(entry, { ...entry.response, status: "completed", outcome: "committed", error: undefined, result });
      } catch {
        this.blocked.add(entry.documentId);
        await this.journal.finish(entry, {
          ...entry.response, status: "recovery_required", outcome: "unknown",
          error: { code: "OPERATION_RECOVERY_REQUIRED", message: "저장 결과를 확인할 수 없습니다. 자동 재실행하지 마세요.", retryable: false },
        });
      }
    }
  }
  private async serial<T>(action: () => Promise<T>): Promise<T> {
    const next = this.queue.then(async () => { await this.initialize(); return action(); });
    this.queue = next.catch(() => undefined);
    return next;
  }
  private writable(id: string): void {
    if (this.blocked.has(id)) failure("OPERATION_RECOVERY_REQUIRED", "이 문서의 이전 저장 결과를 먼저 복구해야 합니다.");
  }
  list() { return this.serial(() => this.repository.list()); }
  listTrash() { return this.serial(() => this.repository.listTrash()); }
  load(id: string): Promise<SavedDocument> {
    return this.serial(async () => { const document = await this.repository.load(id); return { document, revision: documentRevision(document) }; });
  }
  listComponents() { return this.serial(() => this.components.list()); }
  loadComponent(id: string) { return this.serial(() => this.components.load(id)); }
  saveComponent(input: ComponentLibraryPackageInput) { return this.serial(() => this.components.save(input)); }
  deleteComponent(id: string) { return this.serial(() => this.components.remove(id)); }
  create(): Promise<{ summary: DocumentSummary; document: DocumentData; revision: string }> {
    return this.serial(async () => {
      const document = createEmptyDocument({ name: DEFAULT_DOCUMENT_NAME });
      const identity = this.uiIdentity("create_document", { name: document.name });
      const result: CreateResult = { requestId: identity.requestId, status: "completed", documentId: document.documentId, rootNodeId: document.rootNodeId, revision: documentRevision(document), persisted: true };
      await this.commit(identity, document, null, result, true);
      return { document, revision: result.revision, summary: { id: document.documentId, name: document.name, createdAt: document.updatedAt, updatedAt: document.updatedAt } };
    });
  }
  save(id: string, document: DocumentData, expectedRevision: string): Promise<SaveDocumentResult> {
    return this.serial(async () => {
      this.writable(id);
      if (!isDocumentData(document) || document.documentId !== id) failure("VALIDATION_FAILED", "문서 형식이 올바르지 않습니다.");
      const current = await this.repository.load(id);
      this.assertRevision(current, expectedRevision);
      const next = this.normalizedSnapshot(current, document);
      const identity = this.uiIdentity("apply_operations", { documentId: id, expectedRevision, revision: documentRevision(next) });
      const result = this.applyResponse(identity, current, { document: next, changes: emptyChanges(), results: [], warnings: [] }, true);
      const summary = await this.commit(identity, next, expectedRevision, result);
      return { summary, revision: documentRevision(next) };
    });
  }
  rename(id: string, name: string) {
    return this.manage(id, async () => {
      const current = await this.repository.load(id);
      const next = this.normalizedSnapshot(current, { ...current, name: normalizeDocumentName(name) });
      const identity = this.uiIdentity("apply_operations", { documentId: id, name });
      const result = this.applyResponse(identity, current, { document: next, changes: emptyChanges(), results: [], warnings: [] }, false);
      return this.commit(identity, next, documentRevision(current), result);
    });
  }
  remove(id: string) { return this.manage(id, () => this.repository.remove(id)); }
  restore(id: string) { return this.manage(id, () => this.repository.restore(id)); }
  permanentlyDelete(id: string) { return this.manage(id, () => this.repository.permanentlyDelete(id)); }
  private manage<T>(id: string, action: () => Promise<T>): Promise<T> {
    return this.serial(async () => {
      this.writable(id);
      // Management acts from the library screen; never rename/remove an open draft behind its back.
      const context = await this.coordinator.inspect(id);
      if (context) failure("DOCUMENT_BUSY", "열린 문서를 닫은 뒤 문서 관리 작업을 진행하세요.");
      return action();
    });
  }
  async operation(credentialId: string, requestId: string): Promise<JournalEntry | undefined> {
    await this.initialize(); return this.journal.get(credentialId, requestId);
  }
  async mutate(
    identity: MutationIdentity | undefined, input: { documentId: string; expectedRevision: string; dryRun: boolean },
    authorize: Authorize, transform: (document: DocumentData) => Promise<Mutation> | Mutation,
  ): Promise<ApplyResult> {
    await authorize();
    if (identity) { const prior = await this.duplicate(identity); if (prior) return prior as ApplyResult; }
    return this.serial(async () => {
      await authorize();
      if (identity) { const prior = await this.duplicate(identity); if (prior) return prior as ApplyResult; }
      this.writable(input.documentId);
      const lease = await this.coordinator.acquire(input.documentId);
      try {
        const current = await this.repository.load(input.documentId);
        this.assertRevision(current, input.expectedRevision);
        const mutation = await transform(structuredClone(current));
        if (mutation.document.documentId !== current.documentId || !isDocumentData(mutation.document)) failure("VALIDATION_FAILED", "변경 후 문서 형식이 올바르지 않습니다.");
        mutation.document = this.normalizedSnapshot(current, mutation.document);
        await authorize();
        if (input.dryRun) return { documentId: input.documentId, baseRevision: input.expectedRevision, dryRun: true, persisted: false, changes: mutation.changes, warnings: mutation.warnings };
        if (!identity) failure("VALIDATION_FAILED", "requestId가 필요합니다.");
        const result = this.applyResponse(identity, current, mutation, false);
        await this.commit(identity, mutation.document, input.expectedRevision, result);
        const uiSynced = await this.coordinator.apply(lease, { document: mutation.document, revision: result.revision });
        const completed = { ...result, uiSynced };
        const entry = await this.journal.get(identity.credentialId, identity.requestId);
        if (entry) {
          // A missing acknowledgement cannot turn a durable document write into a retryable failure.
          await this.journal.finish(entry, { ...entry.response, result: completed }).catch(() => undefined);
        }
        return completed;
      } finally { await this.coordinator.release(lease); }
    });
  }
  async createForAgent(identity: MutationIdentity, name: string, authorize: Authorize): Promise<CreateResult> {
    await authorize();
    const prior = await this.duplicate(identity); if (prior) return prior as CreateResult;
    return this.serial(async () => {
      await authorize();
      const prior = await this.duplicate(identity); if (prior) return prior as CreateResult;
      const document = createEmptyDocument({ name });
      const result: CreateResult = { requestId: identity.requestId, status: "completed", documentId: document.documentId, rootNodeId: document.rootNodeId, revision: documentRevision(document), persisted: true };
      await this.commit(identity, document, null, result, true);
      return result;
    });
  }
  private assertRevision(document: DocumentData, expected: string): void {
    const currentRevision = documentRevision(document);
    if (expected !== currentRevision) failure("REVISION_CONFLICT", "문서가 변경되었습니다. 다시 읽고 수정 내용을 계산하세요.", { currentRevision });
  }
  private normalizedSnapshot(current: DocumentData, next: DocumentData): DocumentData {
    const comparable = { ...next, name: normalizeDocumentName(next.name), updatedAt: current.updatedAt };
    return documentRevision(current) === documentRevision(comparable) ? current : { ...comparable, updatedAt: new Date().toISOString() };
  }
  private applyResponse(identity: MutationIdentity, current: DocumentData, mutation: Mutation, uiSynced: boolean) {
    return { requestId: identity.requestId, status: "completed" as const, documentId: current.documentId,
      previousRevision: documentRevision(current), revision: documentRevision(mutation.document), persisted: true as const,
      uiSynced, changes: mutation.changes, results: mutation.results };
  }
  private uiIdentity(tool: string, input: Record<string, unknown>): MutationIdentity {
    return { credentialId: "ui", requestId: randomUUID(), hash: requestHash(tool, input) };
  }
  private async duplicate(identity: MutationIdentity): Promise<JournalResult["result"] | undefined> {
    await this.initialize();
    const entry = await this.journal.get(identity.credentialId, identity.requestId);
    if (!entry) return;
    if (entry.requestHash !== identity.hash) failure("REQUEST_ID_REUSED", "이 requestId는 다른 입력에 이미 사용했습니다.");
    if (entry.response.status === "completed") return entry.response.result;
    if (entry.response.status === "pending") return { requestId: identity.requestId, status: "pending" };
    throw new CommandFailure("OPERATION_RECOVERY_REQUIRED", "이전 저장 결과를 먼저 확인하세요.");
  }
  private async commit(identity: MutationIdentity, snapshot: DocumentData, previousRevision: string | null, result: JournalResult["result"], created = false): Promise<DocumentSummary> {
    this.writable(snapshot.documentId);
    const entry: JournalEntry = {
      credentialId: identity.credentialId, requestHash: identity.hash, documentId: snapshot.documentId,
      previousRevision, nextRevision: documentRevision(snapshot), created, stagedId: randomUUID(),
      response: { requestId: identity.requestId, tool: created ? "create_document" : "apply_operations", status: "pending", outcome: "unknown", result },
    };
    // Once prepare starts an I/O failure may have persisted it; fail closed and recover at startup.
    try {
      await this.journal.prepare(entry, snapshot); this.fault?.("prepared");
      const summary = await this.repository.commitSnapshot(snapshot, previousRevision); this.fault?.("document-saved");
      if (created && identity.credentialId !== "ui") await this.grantCreated(identity.credentialId, snapshot.documentId);
      this.fault?.("grant-saved");
      await this.journal.finish(entry, { ...entry.response, status: "completed", outcome: "committed" });
      this.fault?.("completed");
      return summary;
    } catch {
      this.blocked.add(snapshot.documentId);
      await this.journal.finish(entry, { ...entry.response, status: "recovery_required", outcome: "unknown" }).catch(() => undefined);
      failure("PERSISTENCE_FAILED", "저장 결과를 확인할 수 없습니다. 같은 requestId의 작업 결과를 다시 조회하세요.", { outcome: "unknown" });
    }
  }
}
function emptyChanges(): Changes { return { affectedNodeIds: [], affectedTargets: [], removedItemIds: [], summary: "문서 저장" }; }
