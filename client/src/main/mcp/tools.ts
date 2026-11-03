import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { AGENT_LIMITS, toolInputSchemas } from "../../foundation/documentCommandSchemas.ts";
import { CommandFailure, type ToolName } from "../../foundation/documentCommands.ts";
import type { DocumentService } from "../application/documentService.ts";
import type { AccessPolicy } from "./accessPolicy.ts";
import { toolDefinition, encodeToolResult } from "./protocol.ts";

const descriptions: Partial<Record<ToolName, string>> = {
  get_context: "Get connection capabilities and the permitted saved document context. Values never include unsaved drafts. More document tools will be exposed as they become available.",
};
export function createAgentProtocol(policy: AccessPolicy, service: DocumentService, credentialId: string, appVersion: string): Server {
  const server = new Server({ name: "formleaf", version: appVersion }, {
    capabilities: { tools: {} },
    instructions: "Formleaf edits local canonical documents through granted tools. Permissions are managed in the Formleaf app. This connection does not grant shell or filesystem access. Always re-read revision before writing; never retry an unknown operation under a new requestId.",
  });
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    policy.current(credentialId);
    return { tools: (Object.keys(descriptions) as ToolName[]).map((name) => toolDefinition(name, descriptions[name]!)) };
  });
  server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
    policy.current(credentialId);
    const name = params.name as ToolName;
    if (!Object.hasOwn(descriptions, name)) throw new Error("Unknown tool");
    try {
      const parsed = toolInputSchemas[name].safeParse(params.arguments ?? {});
      if (!parsed.success) throw new CommandFailure("VALIDATION_FAILED", "입력 형식·필드·값 범위를 확인하세요.");
      if (name !== "get_context") throw new CommandFailure("UNSUPPORTED_OPERATION", "아직 제공하지 않는 도구입니다.");
      let activeDocument = null;
      let selection = null;
      const current = service.coordinator.current();
      if (current && policy.current(credentialId).documentIds.includes(current.documentId)) {
        const context = await service.coordinator.inspect(current.documentId);
        if (context) {
          const snapshot = await service.load(current.documentId);
          activeDocument = { documentId: current.documentId, revision: snapshot.revision, hasUnsavedChanges: context.hasUnsavedChanges, isEditing: context.isEditing };
          selection = context.selection ? { documentId: current.documentId, ...context.selection } : null;
        }
      }
      const grants = policy.current(credentialId);
      if (activeDocument && !grants.documentIds.includes(activeDocument.documentId)) { activeDocument = null; selection = null; }
      return encodeToolResult(name, { ok: true, data: { apiVersion: "1", appVersion, schemaVersion: 4, workspaceId: policy.settings().workspaceId, capabilities: grants, activeDocument, selection, supportedOperations: [], limits: AGENT_LIMITS } });
    } catch (error) {
      const detail = error instanceof CommandFailure ? error.detail : { code: "NOT_FOUND_OR_DENIED" as const, message: "요청한 정보에 접근할 수 없습니다.", retryable: false };
      return encodeToolResult(name, { ok: false, error: detail });
    }
  });
  return server;
}
