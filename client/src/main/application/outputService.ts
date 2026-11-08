import { AGENT_LIMITS } from "../../foundation/documentCommandSchemas.ts";
import { CommandFailure, failure, type ToolInput } from "../../foundation/documentCommands.ts";
import type { DocumentService } from "./documentService.ts";
import { requestHash } from "./documentRevision.ts";
import { ArtifactRepository, artifactResult } from "./artifactRepository.ts";
import type { JournalEntry } from "./operationJournal.ts";
import type { SnapshotRenderer } from "./renderService.ts";
import type { AccessPolicy } from "../mcp/accessPolicy.ts";

export class OutputService {
  readonly artifacts: ArtifactRepository;
  private readonly documents: DocumentService;
  private readonly policy: AccessPolicy;
  private readonly renderer: SnapshotRenderer;
  private readonly running = new Set<string>();
  private readonly onChange?: () => void;
  constructor(documents: DocumentService, policy: AccessPolicy, renderer: SnapshotRenderer, artifacts: ArtifactRepository, onChange?: () => void) {
    this.documents = documents; this.policy = policy; this.renderer = renderer; this.artifacts = artifacts; this.onChange = onChange;
  }
  async initialize(): Promise<void> {
    await this.artifacts.cleanup();
    for (const entry of await this.documents.journal.list()) {
      if (entry.response.tool !== "export_pdf" || (entry.response.status !== "pending" && entry.response.status !== "recovery_required")) continue;
      try {
        const artifact = entry.artifactId ? await this.artifacts.metadata(entry.artifactId) : undefined;
        if (artifact?.committed) {
          await this.documents.journal.finish(entry, { ...entry.response, status: "completed", outcome: "committed", result: artifactResult(artifact), error: undefined });
        } else {
          if (entry.artifactId) await this.artifacts.fail(entry.artifactId);
          await this.documents.journal.finish(entry, { ...entry.response, status: "failed", outcome: "not_committed", error: { code: "RENDER_FAILED", message: "출력이 완료되기 전에 앱이 종료됐습니다. 새 requestId로 다시 출력하세요.", retryable: false } });
        }
      } catch {
        await this.documents.journal.finish(entry, { ...entry.response, status: "recovery_required", outcome: "unknown", error: { code: "OPERATION_RECOVERY_REQUIRED", message: "출력 결과 확인이 필요합니다.", retryable: false } });
      }
    }
  }
  private async authorize(credentialId: string, documentId: string) {
    this.policy.document(credentialId, documentId, "render");
    try { await this.documents.load(documentId); } catch { failure("NOT_FOUND_OR_DENIED", "문서를 찾을 수 없거나 접근할 수 없습니다."); }
    this.policy.document(credentialId, documentId, "render");
  }
  async preview(credentialId: string, input: ToolInput<"preview_document">) {
    await this.authorize(credentialId, input.documentId);
    const snapshot = await this.documents.load(input.documentId);
    if (snapshot.revision !== input.expectedRevision) failure("REVISION_CONFLICT", "저장 문서가 변경되었습니다. 다시 조회하세요.", { currentRevision: snapshot.revision });
    const output = await this.renderer.render(snapshot, "preview", input.page, () => this.authorize(credentialId, input.documentId));
    await this.authorize(credentialId, input.documentId);
    if (output.bytes.length > AGENT_LIMITS.previewBytes) failure("RESULT_TOO_LARGE", "미리보기가 이미지 크기 한도를 초과합니다.");
    return { data: { documentId: input.documentId, revision: snapshot.revision, page: input.page, pageCount: output.pageCount, widthPx: output.widthPx, heightPx: output.heightPx, mimeType: "image/png" as const, warnings: output.warnings }, image: output.bytes };
  }
  async export(credentialId: string, input: ToolInput<"export_pdf">) {
    const authorize = () => { this.policy.document(credentialId, input.documentId, "render"); };
    const prepared = await this.documents.prepareExport(
      { credentialId, requestId: input.requestId, hash: requestHash("export_pdf", input) }, input.documentId, input.expectedRevision, authorize,
      async (snapshot) => (await this.artifacts.reserve({ credentialId, documentId: input.documentId, revision: snapshot.revision, filename: input.filename ?? safeFilename(snapshot.document.name) })).artifactId,
    );
    const response = prepared.entry.response;
    if (response.status === "completed") return { requestId: input.requestId, status: "completed" as const, ...response.result };
    if (response.status === "failed") throw new CommandFailure(response.error?.code ?? "RENDER_FAILED", response.error?.message ?? "출력에 실패했습니다.");
    if (response.status === "recovery_required") failure("OPERATION_RECOVERY_REQUIRED", "이전 출력 결과를 먼저 확인하세요.");
    if (!prepared.duplicate) this.run(prepared.entry).catch((error: unknown) => console.error("Output job finalization failed", error));
    return { requestId: input.requestId, status: "pending" as const };
  }
  private async run(entry: JournalEntry): Promise<void> {
    const key = `${entry.credentialId}:${entry.response.requestId}`;
    if (this.running.has(key)) return; this.running.add(key);
    try {
      const document = await this.documents.journal.snapshot(entry);
      await this.authorize(entry.credentialId, entry.documentId);
      const output = await this.renderer.render({ document, revision: entry.nextRevision }, "pdf", 1, () => this.authorize(entry.credentialId, entry.documentId));
      await this.authorize(entry.credentialId, entry.documentId);
      if (!entry.artifactId) failure("OPERATION_RECOVERY_REQUIRED", "출력 예약을 찾을 수 없습니다.");
      const artifact = await this.artifacts.complete(entry.artifactId, output.bytes, output.warnings);
      await this.documents.journal.finish(entry, { ...entry.response, status: "completed", outcome: "committed", result: artifactResult(artifact) });
    } catch (error) {
      // Inspect the artifact commit marker before declaring a failure or allowing a retry.
      try {
        const artifact = entry.artifactId ? await this.artifacts.metadata(entry.artifactId) : undefined;
        if (artifact?.status === "completed") {
          await this.documents.journal.finish(entry, { ...entry.response, status: "completed", outcome: "committed", result: artifactResult(artifact) });
        } else {
          if (entry.artifactId) await this.artifacts.fail(entry.artifactId);
          const detail = error instanceof CommandFailure ? error.detail : { code: "RENDER_FAILED" as const, message: "문서 출력에 실패했습니다.", retryable: false };
          await this.documents.journal.finish(entry, { ...entry.response, status: "failed", outcome: "not_committed", error: detail });
        }
      } catch {
        await this.documents.journal.finish(entry, { ...entry.response, status: "recovery_required", outcome: "unknown", error: { code: "OPERATION_RECOVERY_REQUIRED", message: "출력 결과 확인이 필요합니다.", retryable: false } }).catch(() => undefined);
      }
    } finally { this.running.delete(key); try { this.onChange?.(); } catch { /* Window closed. */ } }
  }
  async artifact(credentialId: string, id: string) {
    const metadata = await this.artifacts.metadata(id);
    if (!metadata || metadata.credentialId !== credentialId) failure("NOT_FOUND_OR_DENIED", "출력을 찾을 수 없거나 접근할 수 없습니다.");
    await this.authorize(credentialId, metadata.documentId);
    const bytes = await this.artifacts.read(id);
    this.policy.document(credentialId, metadata.documentId, "render");
    return { metadata, bytes };
  }
}
function safeFilename(name: string): string {
  const stem = name.trim().replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, "-").replace(/\.+$/g, "").slice(0, 116);
  return `${stem || "document"}.pdf`;
}
