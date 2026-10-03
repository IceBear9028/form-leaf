import type { ResumeDocument } from "../../../shared/resume";

export type RuntimeResumeStyleSheet = {
  id: ResumeDocument["styleSheetId"];
  className: string;
  page: {
    widthMm: number;
    heightMm: number;
  };
};

const referenceResumeV1: RuntimeResumeStyleSheet = Object.freeze({
  id: "reference-resume-v1",
  className: "resume-style-reference-v1",
  page: {
    widthMm: 210,
    heightMm: 297,
  },
});

const styleSheets: Record<ResumeDocument["styleSheetId"], RuntimeResumeStyleSheet> = {
  "reference-resume-v1": referenceResumeV1,
};

export function getResumeStyleSheet(id: ResumeDocument["styleSheetId"]): RuntimeResumeStyleSheet {
  return styleSheets[id];
}
