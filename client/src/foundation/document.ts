import type { DocumentData } from "./documentModel.ts";

export * from "./documentModel.ts";
export * from "./documentStylePresets.ts";
export * from "./documentComponentOperations.ts";
export * from "./documentEditing.ts";
export * from "./documentTransactions.ts";
export * from "./documentValidation.ts";

export { isDocumentData as isWorkspaceDocument } from "./documentValidation.ts";

export type PdfExportResult =
  | { canceled: true }
  | { canceled: false; filePath: string };

export type WorkspaceDocument = DocumentData;
