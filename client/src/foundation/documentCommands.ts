import type { z } from "zod";
import type {
  operationSchema, toolInputSchemas, commandErrorSchema, changesSchema,
  operationResultSchema, applyResultSchema, createResultSchema, journalResultSchema,
} from "./documentCommandSchemas.ts";

export type Operation = z.infer<typeof operationSchema>;
export type ToolName = keyof typeof toolInputSchemas;
export type ToolInput<T extends ToolName> = z.infer<(typeof toolInputSchemas)[T]>;
export type CommandError = z.infer<typeof commandErrorSchema>;
export type CommandErrorCode = CommandError["code"];
export type Changes = z.infer<typeof changesSchema>;
export type OperationResult = z.infer<typeof operationResultSchema>;
export type ApplyResult = z.infer<typeof applyResultSchema>;
export type CreateResult = z.infer<typeof createResultSchema>;
export type JournalResult = z.infer<typeof journalResultSchema>;
export type ToolResult<T> = { ok: true; data: T } | { ok: false; error: CommandError };

export class CommandFailure extends Error {
  readonly detail: CommandError;
  constructor(code: CommandErrorCode, message: string, details?: CommandError["details"], retryable = false) {
    super(message);
    this.name = "CommandFailure";
    this.detail = { code, message, retryable, ...(details ? { details } : {}) };
  }
}
export function failure(code: CommandErrorCode, message: string, details?: CommandError["details"]): never {
  throw new CommandFailure(code, message, details);
}
