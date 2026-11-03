import { z } from "zod";
import { ToolSchema, type CallToolResult, type Tool } from "@modelcontextprotocol/sdk/types.js";
import { AGENT_LIMITS, opaqueIdSchema, toolInputSchemas } from "../../foundation/documentCommandSchemas.ts";
import { toolOutputSchemas } from "../../foundation/documentToolResults.ts";
import { CommandFailure, type ToolName, type ToolResult } from "../../foundation/documentCommands.ts";

// Model-facing tool definitions use object roots. Conditional required fields
// remain described here and enforced by the original strict runtime unions.
const advertisedInputSchemas = {
  ...toolInputSchemas,
  apply_operations: z.strictObject({
    ...toolInputSchemas.apply_operations.options[0].shape,
    dryRun: z.boolean().default(false).describe("true validates only; omit requestId. false (default) persists and requires requestId."),
    requestId: z.uuid().optional().describe("Required for real writes (dryRun false or omitted). Forbidden when dryRun is true. Reuse the same ID and input after a lost response."),
  }),
  get_component: z.strictObject({
    source: z.enum(["library", "document"]),
    libraryItemId: opaqueIdSchema.optional().describe("Required only for source=library; omit documentId and componentId."),
    documentId: opaqueIdSchema.optional().describe("Required with componentId for source=document; omit libraryItemId."),
    componentId: opaqueIdSchema.optional().describe("Required with documentId for source=document."),
  }),
};
export function toolDefinition(name: ToolName, description: string): Tool {
  return ToolSchema.parse({
    name, description,
    inputSchema: z.toJSONSchema(advertisedInputSchemas[name], { io: "input" }),
    outputSchema: { ...z.toJSONSchema(toolOutputSchemas[name]), type: "object" },
  });
}
export function encodeToolResult<T>(name: ToolName, result: ToolResult<T>): CallToolResult {
  const serialized = JSON.stringify(result);
  if (Buffer.byteLength(serialized, "utf8") > AGENT_LIMITS.jsonBytes) {
    throw new CommandFailure("RESULT_TOO_LARGE", "결과가 너무 큽니다. 대상 목록과 개별 값 조회를 사용하세요.");
  }
  toolOutputSchemas[name].parse(result);
  return {
    content: [{ type: "text", text: serialized }], structuredContent: result,
    ...(!result.ok ? { isError: true } : {}),
  };
}
