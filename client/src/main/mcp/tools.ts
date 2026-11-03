import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ListResourceTemplatesRequestSchema, ReadResourceRequestSchema, McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { AGENT_LIMITS, toolInputSchemas } from "../../foundation/documentCommandSchemas.ts";
import { CommandFailure, type ToolName, type ToolInput } from "../../foundation/documentCommands.ts";
import type { DocumentService } from "../application/documentService.ts";
import type { AccessPolicy } from "./accessPolicy.ts";
import { toolDefinition, encodeToolResult } from "./protocol.ts";
import { CursorPager } from "./cursors.ts";
import { AgentReads } from "./readTools.ts";

const resourcePager = new CursorPager();
const descriptions: Partial<Record<ToolName, string>> = {
  get_context: "Read current connection capabilities and the permitted saved document context. Unsaved drafts are never returned.",
  list_documents: "Find permitted documents by name. Get a saved revision with get_document before editing.",
  get_document: "Read a saved outline (default) or canonical read-only DTO. Image asset bytes are excluded. Archived nodes are marked; component internals are read with get_component.",
  list_edit_targets: "List editable text/Markdown/rich-text targets in document order. IDs distinguish matching labels. Archived subtrees/props are excluded. Cursor expires after ten minutes or when the snapshot changes.",
  get_edit_value: "Read a typed target value and its saved revision, default/override source and Markdown codec compatibility. A Markdown target is the entire Markdown string; unsupported syntax stays intact.",
  list_components: "Find personal component library entries. Requires libraryRead. Library IDs are distinct from document component IDs.",
  get_component: "Read a library component package or a component in a permitted document. Props include types, defaults and active/archived status. Image bytes are excluded.",
  get_operation: "Read this credential's persistent operation status. Unknown outcomes must not be automatically re-executed with a new requestId. Current document permissions still apply.",
};
export function createAgentProtocol(policy: AccessPolicy, service: DocumentService, credentialId: string, appVersion: string): Server {
  const reads = new AgentReads(policy, service, credentialId, appVersion);
  const server = new Server({ name: "formleaf", version: appVersion }, {
    capabilities: { tools: {}, resources: {} },
    instructions: "Formleaf edits local canonical documents through granted tools. Permissions are managed in the app. First inspect context, list documents/targets, and read the exact value and revision. A selection is only context, never implicit write authorization. Never retry an unknown operation under a new requestId. This connection does not grant shell or filesystem access.",
  });
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    policy.current(credentialId);
    return { tools: (Object.keys(descriptions) as ToolName[]).map((name) => toolDefinition(name, descriptions[name]!)) };
  });
  server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
    const name = params.name as ToolName;
    if (!Object.hasOwn(descriptions, name)) throw new McpError(ErrorCode.InvalidParams, "Unknown tool");
    try {
      policy.current(credentialId);
      const parsed = toolInputSchemas[name].safeParse(params.arguments ?? {});
      if (!parsed.success) throw new CommandFailure("VALIDATION_FAILED", "입력 형식·필드·값 범위를 확인하세요.");
      const input = <N extends ToolName>(_name: N) => parsed.data as ToolInput<N>;
      let data: unknown;
      switch (name) {
        case "get_context": data = await reads.context(); break;
        case "list_documents": data = await reads.documents(input(name)); break;
        case "get_document": data = await reads.document(input(name)); break;
        case "list_edit_targets": data = await reads.targets(input(name)); break;
        case "get_edit_value": data = await reads.value(input(name)); break;
        case "list_components": data = await reads.components(input(name)); break;
        case "get_component": data = await reads.component(input(name)); break;
        case "get_operation": data = await reads.operation(input(name)); break;
        default: throw new CommandFailure("UNSUPPORTED_OPERATION", "아직 제공하지 않는 도구입니다.");
      }
      policy.current(credentialId);
      if ("documentId" in parsed.data) policy.document(credentialId, parsed.data.documentId);
      if (name === "list_components" || ("source" in parsed.data && parsed.data.source === "library")) policy.capability(credentialId, "libraryRead");
      return encodeToolResult(name, { ok: true, data });
    } catch (error) {
      const detail = error instanceof CommandFailure ? error.detail : { code: "NOT_FOUND_OR_DENIED" as const, message: "요청한 정보에 접근할 수 없습니다.", retryable: false };
      return encodeToolResult(name, { ok: false, error: detail });
    }
  });
  server.setRequestHandler(ListResourcesRequestSchema, async ({ params }) => {
    const documents = await service.list(); const grants = policy.current(credentialId);
    const resources = [
      { uri: "formleaf://schema/document", name: "Formleaf document schema", mimeType: "application/json" },
      ...documents.filter((doc) => grants.documentIds.includes(doc.id)).map((doc) => ({ uri: `formleaf://documents/${encodeURIComponent(doc.id)}`, name: doc.name, mimeType: "application/json" })),
    ];
    const result = resourcePager.page(resources, credentialId, { resource: "documents" }, 100, params?.cursor);
    return { resources: result.items, ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}) };
  });
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    policy.current(credentialId);
    return { resourceTemplates: [{ uriTemplate: "formleaf://documents/{id}", name: "Permitted document outline", mimeType: "application/json" }] };
  });
  server.setRequestHandler(ReadResourceRequestSchema, async ({ params }) => {
    try {
      policy.current(credentialId);
      let data: unknown;
      if (params.uri === "formleaf://schema/document") data = reads.schema();
      else if (/^formleaf:\/\/documents\/[^/?#]+$/.test(params.uri)) {
        const documentId = decodeURIComponent(params.uri.slice("formleaf://documents/".length));
        data = await reads.document({ documentId, view: "outline" });
        policy.document(credentialId, documentId);
      } else throw new CommandFailure("NOT_FOUND_OR_DENIED", "Resource에 접근할 수 없습니다.");
      const text = JSON.stringify(data);
      if (Buffer.byteLength(text, "utf8") > AGENT_LIMITS.jsonBytes) throw new CommandFailure("RESULT_TOO_LARGE", "결과가 너무 큽니다. 대상 목록과 개별 값 조회를 사용하세요.");
      return { contents: [{ uri: params.uri, mimeType: "application/json", text }] };
    } catch (error) {
      throw new McpError(ErrorCode.InvalidParams, error instanceof CommandFailure ? error.detail.code : "NOT_FOUND_OR_DENIED");
    }
  });
  return server;
}
