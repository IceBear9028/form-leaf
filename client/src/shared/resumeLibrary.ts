import type { PdfExportResult, ResumeDocument } from "./resume";

export const RESUME_LIBRARY_SCHEMA_VERSION = 1 as const;
export const DEFAULT_RESUME_TITLE = "제목 없는 이력서";

export type ResumeSummary = {
  id: string;
  title: string;
  profileName: string;
  createdAt: string;
  updatedAt: string;
};

export type DeletedResumeSummary = ResumeSummary & {
  deletedAt: string;
};

export type ResumeLibraryIndex = {
  schemaVersion: typeof RESUME_LIBRARY_SCHEMA_VERSION;
  resumes: ResumeSummary[];
  trash: DeletedResumeSummary[];
};

export type ResumeStudioApi = {
  listResumes: () => Promise<ResumeSummary[]>;
  listDeletedResumes: () => Promise<DeletedResumeSummary[]>;
  createResume: () => Promise<{ summary: ResumeSummary; document: ResumeDocument }>;
  loadResume: (id: string) => Promise<ResumeDocument>;
  saveResume: (id: string, document: ResumeDocument) => Promise<ResumeSummary>;
  renameResume: (id: string, title: string) => Promise<ResumeSummary>;
  deleteResume: (id: string) => Promise<void>;
  restoreResume: (id: string) => Promise<ResumeSummary>;
  permanentlyDeleteResume: (id: string) => Promise<void>;
  exportPdf: (suggestedName: string) => Promise<PdfExportResult>;
  showInFolder: (filePath: string) => Promise<void>;
};

export function createEmptyLibraryIndex(): ResumeLibraryIndex {
  return {
    schemaVersion: RESUME_LIBRARY_SCHEMA_VERSION,
    resumes: [],
    trash: [],
  };
}

export function normalizeResumeTitle(title: string): string {
  return title.trim() || DEFAULT_RESUME_TITLE;
}

export function profileNameFromDocument(document: ResumeDocument): string {
  const profile = document.sections.find((section) => section.type === "profile");
  return profile?.name.trim() ?? "";
}

export function summaryFromDocument(
  document: ResumeDocument,
  createdAt: string,
): ResumeSummary {
  return {
    id: document.documentId,
    title: normalizeResumeTitle(document.name),
    profileName: profileNameFromDocument(document),
    createdAt,
    updatedAt: document.updatedAt,
  };
}

export function sortResumeSummaries(summaries: ResumeSummary[]): ResumeSummary[] {
  return [...summaries].sort((left, right) =>
    compareIsoDescending(left.updatedAt, right.updatedAt) ||
    compareIsoDescending(left.createdAt, right.createdAt) ||
    left.id.localeCompare(right.id),
  );
}

export function sortDeletedResumeSummaries(
  summaries: DeletedResumeSummary[],
): DeletedResumeSummary[] {
  return [...summaries].sort((left, right) =>
    compareIsoDescending(left.deletedAt, right.deletedAt) ||
    left.id.localeCompare(right.id),
  );
}

export function isResumeLibraryIndex(value: unknown): value is ResumeLibraryIndex {
  if (!isRecord(value)) return false;
  return value.schemaVersion === RESUME_LIBRARY_SCHEMA_VERSION &&
    Array.isArray(value.resumes) && value.resumes.every(isResumeSummary) &&
    Array.isArray(value.trash) && value.trash.every(isDeletedResumeSummary);
}

function isResumeSummary(value: unknown): value is ResumeSummary {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.profileName === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string";
}

function isDeletedResumeSummary(value: unknown): value is DeletedResumeSummary {
  return isResumeSummary(value) &&
    typeof (value as ResumeSummary & { deletedAt?: unknown }).deletedAt === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareIsoDescending(left: string, right: string): number {
  return right.localeCompare(left);
}
