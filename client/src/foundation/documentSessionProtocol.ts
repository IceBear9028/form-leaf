import { z } from "zod";
import { editTargetSchema } from "./documentCommandSchemas.ts";
import type { DocumentData } from "./documentModel.ts";
import type { DocumentEditTarget } from "./documentEditing.ts";
import type { DocumentSummary } from "./documentLibrary.ts";

export type SavedDocument = { document: DocumentData; revision: string };
export type SaveDocumentResult = { summary: DocumentSummary; revision: string };
export type EditorContext = {
  documentId: string; revision: string; hasUnsavedChanges: boolean; isEditing: boolean;
  selection: { target: DocumentEditTarget | null; nodeId?: string } | null;
};
export type EditorRequest =
  | { type: "inspect"; requestId: string; documentId: string }
  | { type: "acquire"; requestId: string; documentId: string }
  | { type: "apply"; requestId: string; documentId: string; leaseId: string; snapshot: SavedDocument }
  | { type: "release"; requestId: string; documentId: string; leaseId: string };
export type EditorReply = {
  requestId: string; ok: boolean; context: EditorContext | null; leaseId?: string;
};

// Validate IPC messages before they reach the coordinator's typed state.
export const editorContextSchema: z.ZodType<EditorContext> = z.strictObject({
  documentId: z.string(), revision: z.string(), hasUnsavedChanges: z.boolean(), isEditing: z.boolean(),
  selection: z.strictObject({ target: editTargetSchema.nullable(), nodeId: z.string().optional() }).nullable(),
});
export const editorReplySchema: z.ZodType<EditorReply> = z.strictObject({
  requestId: z.string(), ok: z.boolean(), context: editorContextSchema.nullable(), leaseId: z.string().optional(),
});
