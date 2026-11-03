import type { OutputService } from "../application/outputService.ts";
import { artifactResult } from "../application/artifactRepository.ts";
import { FontCatalog } from "../application/fontCatalog.ts";
import { applyDocumentOperations } from "../application/documentOperationAdapter.ts";
import { requestHash } from "../application/documentRevision.ts";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ListResourceTemplatesRequestSchema, ReadResourceRequestSchema, McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { AGENT_LIMITS, toolInputSchemas } from "../../foundation/documentCommandSchemas.ts";
import { CommandFailure, type ToolName, type ToolInput } from "../../foundation/documentCommands.ts";
import type { DocumentService } from "../application/documentService.ts";
import type { AccessPolicy } from "./accessPolicy.ts";
import { toolDefinition, encodeToolResult } from "./protocol.ts";
import { CursorPager } from "./cursors.ts";
import { AgentReads } from "./readTools.ts";

const fontCatalog = new FontCatalog();
const resourcePager = new CursorPager();
const descriptions: Partial<Record<ToolName, string>> = {
  preview_document: "Render one page of the requested saved revision in an isolated hidden window. Requires render. Active editing is preserved. Returns PNG content, dimensions, page count and warnings; external resources are blocked.",
  export_pdf: "Queue a PDF of the requested saved revision. Requires render and a UUID requestId. Query get_operation for completion and read the artifact resource. No output path is accepted. Artifacts expire after 24 hours; current permissions apply on every read.",
  create_document: "Create an empty document with the default root/style. Requires create and write. The new document is granted to this connection without changing UI selection. Use a UUID requestId and reuse the same input/ID after disconnects.",
  apply_operations: "Apply one atomic batch to a permitted saved document. Requires write and expectedRevision. Editing/dirty documents return DOCUMENT_BUSY without flushing. dryRun validates without persisting IDs or a reservation. Real writes require a unique UUID requestId; retry the same normalized input under that ID or query get_operation.",
  get_context: "Read current connection capabilities and the permitted saved document context. Unsaved drafts are never returned.",
  list_documents: "Find permitted documents by name. Get a saved revision with get_document before editing.",
  get_document: "Read a saved outline (default) or canonical read-only DTO. Image asset bytes are excluded. Archived nodes are marked; component internals are read with get_component.",
  list_edit_targets: "List editable text/Markdown/rich-text targets in document order. IDs distinguish matching labels. Archived subtrees/props are excluded. Cursor expires after ten minutes or when the snapshot changes.",
  get_edit_value: "Read a typed target value and its saved revision, default/override source and Markdown codec compatibility. A Markdown target is the entire Markdown string; unsupported syntax stays intact.",
  list_components: "Find personal component library entries. Requires libraryRead. Library IDs are distinct from document component IDs.",
  get_component: "Read a library component package or a component in a permitted document. Props include types, defaults and active/archived status. Image bytes are excluded.",
  get_operation: "Read this credential's persistent operation status. Unknown outcomes must not be automatically re-executed with a new requestId. Current document permissions still apply.",
};
export function createAgentProtocol(policy: AccessPolicy, service: DocumentService, credentialId: string, appVersion: string, outputs?: OutputService): Server {
  const available = Object.fromEntries(Object.entries(descriptions).filter(([name]) => outputs || (name !== "preview_document" && name !== "export_pdf"))) as Partial<Record<ToolName, string>>;
  const reads = new AgentReads(policy, service, credentialId, appVersion);
  const server = new Server({ name: "formleaf", version: appVersion }, {
    capabilities: { tools: {}, resources: {} },
    instructions: "Formleaf edits local canonical documents through granted tools. Permissions are managed in the app. First inspect context, list documents/targets, and read the exact value and revision. A selection is only context, never implicit write authorization. Never retry an unknown operation under a new requestId. This connection does not grant shell or filesystem access.",
  });
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    policy.current(credentialId);
    return { tools: (Object.keys(available) as ToolName[]).map((name) => toolDefinition(name, available[name]!)) };
  });
  server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
    const name = params.name as ToolName;
    if (!Object.hasOwn(available, name)) throw new McpError(ErrorCode.InvalidParams, "Unknown tool");
    try {
      policy.current(credentialId);
      const parsed = toolInputSchemas[name].safeParse(params.arguments ?? {});
      if (!parsed.success) throw new CommandFailure("VALIDATION_FAILED", "입력 형식·필드·값 범위를 확인하세요.");
      const input = <N extends ToolName>(_name: N) => parsed.data as ToolInput<N>;
      let data: unknown;
      let image: Buffer | undefined;
      switch (name) {
        case "preview_document": {
          const preview = await outputs!.preview(credentialId, input(name)); data = preview.data; image = preview.image; break;
        }
        case "export_pdf": data = await outputs!.export(credentialId, input(name)); break;
        case "create_document": {
          const args = input(name);
          data = await service.createForAgent({ credentialId, requestId: args.requestId, hash: requestHash(name, args) }, args.name, () => { policy.capability(credentialId, "create"); });
          break;
        }
        case "apply_operations": {
          const args = input(name);
          policy.document(credentialId, args.documentId, "write");
          const fonts = args.operations.some((operation) => operation.type === "update_node_style" && operation.patch.typography?.fontFamily)
            ? await fontCatalog.families() : new Set<string>();
          const identity = args.dryRun ? undefined : { credentialId, requestId: args.requestId, hash: requestHash(name, args) };
          data = await service.mutate(identity, { documentId: args.documentId, expectedRevision: args.expectedRevision, dryRun: args.dryRun }, () => {
            policy.document(credentialId, args.documentId, "write");
            if (args.operations.some((operation) => operation.type === "import_component")) policy.capability(credentialId, "libraryRead");
          }, async (document, context) => {
            const libraries = new Map();
            for (const operation of args.operations) {
              if (operation.type !== "import_component" || libraries.has(operation.libraryItemId)) continue;
              try { libraries.set(operation.libraryItemId, await context.loadComponent(operation.libraryItemId)); }
              catch { throw new CommandFailure("NOT_FOUND_OR_DENIED", "라이브러리 항목에 접근할 수 없습니다."); }
            }
            return applyDocumentOperations(document, args.operations, libraries, fonts);
          });
          break;
        }
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
      const result = encodeToolResult(name, { ok: true, data });
      if (image) result.content.push({ type: "image", mimeType: "image/png", data: image.toString("base64") });
      return result;
    } catch (error) {
      const detail = error instanceof CommandFailure ? error.detail : { code: "NOT_FOUND_OR_DENIED" as const, message: "요청한 정보에 접근할 수 없습니다.", retryable: false };
      return encodeToolResult(name, { ok: false, error: detail });
    }
  });
  server.setRequestHandler(ListResourcesRequestSchema, async ({ params }) => {
    const documents = await service.list(); const grants = policy.current(credentialId);
    const artifacts = outputs && grants.render ? (await outputs.artifacts.list()).filter((item) => item.credentialId === credentialId && item.status === "completed" && item.expiresAt > new Date().toISOString() && documents.some((doc) => doc.id === item.documentId) && grants.documentIds.includes(item.documentId)) : [];
    policy.current(credentialId);
    const resources = [
      ...artifacts.filter((item) => { const current = policy.current(credentialId); return current.render && current.documentIds.includes(item.documentId); }).map((item) => ({ uri: `formleaf://artifacts/${item.artifactId}`, name: item.filename, mimeType: "application/pdf" })),
      { uri: "formleaf://schema/document", name: "Formleaf document schema", mimeType: "application/json" },
      ...documents.filter((doc) => policy.current(credentialId).documentIds.includes(doc.id)).map((doc) => ({ uri: `formleaf://documents/${encodeURIComponent(doc.id)}`, name: doc.name, mimeType: "application/json" })),
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
      if (outputs && /^formleaf:\/\/artifacts\/[^/?#]+$/.test(params.uri)) {
        const artifact = await outputs.artifact(credentialId, params.uri.slice("formleaf://artifacts/".length));
        return { contents: [{ uri: params.uri, mimeType: "application/pdf", blob: artifact.bytes.toString("base64") }], _meta: artifactResult(artifact.metadata) };
      }
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
