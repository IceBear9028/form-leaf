import type { DocumentData } from "./documentModel.ts";

export * from "./documentModel.ts";
export * from "./documentComponentOperations.ts";
export * from "./documentEditing.ts";
export * from "./documentTransactions.ts";
export * from "./documentValidation.ts";

export {
  createDefaultDocument,
  isV1ResumeDocument as isV1WorkspaceDocument,
} from "./content/resume.ts";

export type {
  ResumeDocument,
  V1ResumeDocument,
} from "./content/resume.ts";

export { isDocumentData as isWorkspaceDocument } from "./documentValidation.ts";

export type PdfExportResult =
  | { canceled: true }
  | { canceled: false; filePath: string };

export type WorkspaceDocument = DocumentData;
