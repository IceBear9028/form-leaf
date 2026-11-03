import { z } from "zod";
import { ToolSchema, type CallToolResult, type Tool } from "@modelcontextprotocol/sdk/types.js";
import { AGENT_LIMITS, toolInputSchemas } from "../../foundation/documentCommandSchemas.ts";
import { toolOutputSchemas } from "../../foundation/documentToolResults.ts";
import { CommandFailure, type ToolName, type ToolResult } from "../../foundation/documentCommands.ts";

/** MCP requires an object at the top level, including discriminated object unions. */
export function toolDefinition(name: ToolName, description: string): Tool {
  return ToolSchema.parse({
    name, description,
    inputSchema: { ...z.toJSONSchema(toolInputSchemas[name], { io: "input" }), type: "object" },
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
