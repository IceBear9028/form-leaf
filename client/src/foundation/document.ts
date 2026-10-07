import type { ResumeDocument } from "./content/resume.ts";

export {
  createDefaultDocument,
  isResumeDocument as isWorkspaceDocument,
  isV1ResumeDocument as isV1WorkspaceDocument,
} from "./content/resume.ts";

export type {
  PdfExportResult,
  ResumeDocument,
  V1ResumeDocument,
} from "./content/resume.ts";

/**
 * 저장소와 IPC가 취급하는 최상위 문서 경계다.
 *
 * 현재 저장 schema에는 이력서 한 종류만 있으므로 ResumeDocument와 동일하다.
 * 새로운 문서 종류는 별도 schema migration과 함께 이 경계를 확장한다.
 */
export type WorkspaceDocument = ResumeDocument;
