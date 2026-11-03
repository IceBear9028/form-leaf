import type { AgentOperationSummary } from "../../foundation/agentConnection.ts";
import { failure } from "../../foundation/documentCommands.ts";
import type { AccessPolicy } from "../mcp/accessPolicy.ts";
import type { DocumentService } from "./documentService.ts";
import type { OutputService } from "./outputService.ts";

/** Local owner UI projection. Never send staged snapshots, request bodies or token hashes. */
export class OperationHistory {
  private readonly service: DocumentService;
  private readonly policy: AccessPolicy;
  private readonly outputs: OutputService;
  constructor(service: DocumentService, policy: AccessPolicy, outputs: OutputService) { this.service = service; this.policy = policy; this.outputs = outputs; }
  async recent(): Promise<AgentOperationSummary[]> {
    const documents = await this.service.list();
    const entries = (await this.service.journal.list()).filter((entry) => entry.credentialId !== "ui")
      .sort((a, b) => (b.acceptedAt ?? "").localeCompare(a.acceptedAt ?? "") || a.response.requestId.localeCompare(b.response.requestId)).slice(0, 50);
    const summaries: AgentOperationSummary[] = [];
    for (const entry of entries) {
      const response = entry.response;
      const summary: AgentOperationSummary = {
        credentialId: entry.credentialId, connectionName: "삭제된 연결", requestId: response.requestId,
        tool: response.tool, status: response.status, outcome: response.outcome,
        acceptedAt: entry.acceptedAt, accessible: false,
      };
      let artifact;
      if (entry.artifactId && response.status === "completed") {
        try { artifact = await this.outputs.artifacts.metadata(entry.artifactId); } catch { /* Show status; disable unsafe file actions. */ }
      }
      // Read current grants after the asynchronous metadata read as well.
      const connection = this.policy.settings().connections.find((item) => item.id === entry.credentialId);
      summary.connectionName = connection?.name ?? "삭제된 연결";
      const document = documents.find((item) => item.id === entry.documentId);
      const allowed = connection && !connection.revoked && connection.grants.documentIds.includes(entry.documentId)
        && (response.tool !== "export_pdf" || connection.grants.render);
      if (allowed && document) {
        summary.accessible = true; summary.documentId = entry.documentId; summary.documentName = document.name;
        if (response.status === "completed") {
          summary.revision = entry.nextRevision;
          if (response.result && "persisted" in response.result) summary.persisted = response.result.persisted;
          if (response.result && "uiSynced" in response.result) summary.uiSynced = response.result.uiSynced;
        }
        summary.errorCode = response.error?.code;
        if (artifact && artifact.credentialId === entry.credentialId && artifact.documentId === entry.documentId) {
          summary.artifact = { artifactId: artifact.artifactId, filename: artifact.filename, byteSize: artifact.byteSize, expiresAt: artifact.expiresAt,
            available: this.policy.settings().enabled && artifact.status === "completed" && Date.parse(artifact.expiresAt) > Date.now() };
        }
      }
      summaries.push(summary);
    }
    return summaries;
  }
  async artifact(credentialId: string, requestId: string) {
    const entry = await this.service.operation(credentialId, requestId);
    if (entry?.response.tool !== "export_pdf" || entry.response.status !== "completed" || !entry.artifactId) {
      failure("NOT_FOUND_OR_DENIED", "완료된 PDF를 찾을 수 없습니다.");
    }
    return this.outputs.artifact(credentialId, entry.artifactId);
  }
}
