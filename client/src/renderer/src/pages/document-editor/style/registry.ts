import { resumeStyleSheetPresets } from "./presets.ts";
import type { RuntimeResumeStyleSheet } from "./schema.ts";
import { toResumeCssVariables } from "./toCssVariables.ts";

const styleSheets = new Map(
  resumeStyleSheetPresets.map((input) => {
    const styleSheet: RuntimeResumeStyleSheet = Object.freeze({
      ...input,
      projectTitle: Object.freeze(input.projectTitle),
      markdown: Object.freeze(input.markdown),
      variables: toResumeCssVariables(input),
    });
    return [styleSheet.id, styleSheet] as const;
  }),
);

export function getResumeStyleSheet(id: string): RuntimeResumeStyleSheet {
  return styleSheets.get(id) ?? styleSheets.get("reference-resume-v1")!;
}

export function listResumeStyleSheets(): RuntimeResumeStyleSheet[] {
  return [...styleSheets.values()];
}
