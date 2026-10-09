import type { PdfExportResult } from "./document.ts";
import type { DocumentData } from "./documentModel.ts";
import type {
  ComponentLibraryItem,
  ComponentLibraryPackageInput,
  ComponentLibrarySummary,
} from "./componentLibrary.ts";

export const DOCUMENT_LIBRARY_SCHEMA_VERSION = 2 as const;
export const DEFAULT_DOCUMENT_NAME = "제목 없는 문서";

export type DocumentSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type DeletedDocumentSummary = DocumentSummary & {
  deletedAt: string;
};

export type DocumentLibraryIndex = {
  schemaVersion: typeof DOCUMENT_LIBRARY_SCHEMA_VERSION;
  documents: DocumentSummary[];
  trash: DeletedDocumentSummary[];
};

export type DocumentApi = {
  listDocuments: () => Promise<DocumentSummary[]>;
  listDeletedDocuments: () => Promise<DeletedDocumentSummary[]>;
  createDocument: () => Promise<{ summary: DocumentSummary; document: DocumentData }>;
  loadDocument: (id: string) => Promise<DocumentData>;
  saveDocument: (id: string, document: DocumentData) => Promise<DocumentSummary>;
  renameDocument: (id: string, name: string) => Promise<DocumentSummary>;
  deleteDocument: (id: string) => Promise<void>;
  restoreDocument: (id: string) => Promise<DocumentSummary>;
  permanentlyDeleteDocument: (id: string) => Promise<void>;
  listComponents: () => Promise<ComponentLibrarySummary[]>;
  saveComponent: (input: ComponentLibraryPackageInput) => Promise<ComponentLibrarySummary>;
  loadComponent: (id: string) => Promise<ComponentLibraryItem>;
  deleteComponent: (id: string) => Promise<void>;
  exportPdf: (suggestedName: string) => Promise<PdfExportResult>;
  showInFolder: (filePath: string) => Promise<void>;
};

export function createEmptyLibraryIndex(): DocumentLibraryIndex {
  return {
    schemaVersion: DOCUMENT_LIBRARY_SCHEMA_VERSION,
    documents: [],
    trash: [],
  };
}

export function normalizeDocumentName(name: string): string {
  return name.trim() || DEFAULT_DOCUMENT_NAME;
}

export function summaryFromDocument(
  document: DocumentData,
  createdAt: string,
): DocumentSummary {
  return {
    id: document.documentId,
    name: normalizeDocumentName(document.name),
    createdAt,
    updatedAt: document.updatedAt,
  };
}

export function sortDocumentSummaries(summaries: DocumentSummary[]): DocumentSummary[] {
  return [...summaries].sort((left, right) =>
    compareIsoDescending(left.updatedAt, right.updatedAt) ||
    compareIsoDescending(left.createdAt, right.createdAt) ||
    left.id.localeCompare(right.id),
  );
}

export function sortDeletedDocumentSummaries(
  summaries: DeletedDocumentSummary[],
): DeletedDocumentSummary[] {
  return [...summaries].sort((left, right) =>
    compareIsoDescending(left.deletedAt, right.deletedAt) ||
    left.id.localeCompare(right.id),
  );
}

export function isDocumentLibraryIndex(value: unknown): value is DocumentLibraryIndex {
  if (!isRecord(value)) return false;
  return value.schemaVersion === DOCUMENT_LIBRARY_SCHEMA_VERSION &&
    Array.isArray(value.documents) && value.documents.every(isDocumentSummary) &&
    Array.isArray(value.trash) && value.trash.every(isDeletedDocumentSummary);
}

function isDocumentSummary(value: unknown): value is DocumentSummary {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string";
}

function isDeletedDocumentSummary(value: unknown): value is DeletedDocumentSummary {
  return isDocumentSummary(value) &&
    typeof (value as DocumentSummary & { deletedAt?: unknown }).deletedAt === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareIsoDescending(left: string, right: string): number {
  return right.localeCompare(left);
}
