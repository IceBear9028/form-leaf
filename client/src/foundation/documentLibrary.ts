import type { PdfExportResult, WorkspaceDocument } from "./document.ts";

export const DOCUMENT_LIBRARY_SCHEMA_VERSION = 1 as const;
export const DEFAULT_DOCUMENT_TITLE = "제목 없는 이력서";

export type DocumentSummary = {
  id: string;
  title: string;
  profileName: string;
  createdAt: string;
  updatedAt: string;
};

export type DeletedDocumentSummary = DocumentSummary & {
  deletedAt: string;
};

export type DocumentLibraryIndex = {
  schemaVersion: typeof DOCUMENT_LIBRARY_SCHEMA_VERSION;
  resumes: DocumentSummary[];
  trash: DeletedDocumentSummary[];
};

export type DocumentApi = {
  listDocuments: () => Promise<DocumentSummary[]>;
  listDeletedDocuments: () => Promise<DeletedDocumentSummary[]>;
  createDocument: () => Promise<{ summary: DocumentSummary; document: WorkspaceDocument }>;
  loadDocument: (id: string) => Promise<WorkspaceDocument>;
  saveDocument: (id: string, document: WorkspaceDocument) => Promise<DocumentSummary>;
  renameDocument: (id: string, title: string) => Promise<DocumentSummary>;
  deleteDocument: (id: string) => Promise<void>;
  restoreDocument: (id: string) => Promise<DocumentSummary>;
  permanentlyDeleteDocument: (id: string) => Promise<void>;
  exportPdf: (suggestedName: string) => Promise<PdfExportResult>;
  showInFolder: (filePath: string) => Promise<void>;
};

export function createEmptyLibraryIndex(): DocumentLibraryIndex {
  return {
    schemaVersion: DOCUMENT_LIBRARY_SCHEMA_VERSION,
    resumes: [],
    trash: [],
  };
}

export function normalizeDocumentTitle(title: string): string {
  return title.trim() || DEFAULT_DOCUMENT_TITLE;
}

export function profileNameFromDocument(document: WorkspaceDocument): string {
  const profile = document.sections.find((section) => section.type === "profile");
  return profile?.name.trim() ?? "";
}

export function summaryFromDocument(
  document: WorkspaceDocument,
  createdAt: string,
): DocumentSummary {
  return {
    id: document.documentId,
    title: normalizeDocumentTitle(document.name),
    profileName: profileNameFromDocument(document),
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
    Array.isArray(value.resumes) && value.resumes.every(isDocumentSummary) &&
    Array.isArray(value.trash) && value.trash.every(isDeletedDocumentSummary);
}

function isDocumentSummary(value: unknown): value is DocumentSummary {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.profileName === "string" &&
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
