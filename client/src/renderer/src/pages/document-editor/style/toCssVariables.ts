import type { CSSProperties } from "react";
import type { ResumeStyleSheetInput } from "./schema.ts";

export function toResumeCssVariables(styleSheet: ResumeStyleSheetInput): CSSProperties {
  const tokens = styleSheet.markdown;
  const variables: Record<string, string> = {
    "--resume-project-title-size": `${styleSheet.projectTitle.fontSizePt}pt`,
    "--resume-project-title-line-height": String(styleSheet.projectTitle.lineHeight),
    "--resume-project-title-weight": String(styleSheet.projectTitle.fontWeight),
    "--resume-project-title-color": styleSheet.projectTitle.color,
    "--markdown-font-family": tokens.fontFamily,
    "--markdown-text": tokens.text,
    "--markdown-secondary": tokens.secondaryText,
    "--markdown-muted": tokens.mutedText,
    "--markdown-accent": tokens.accent,
    "--markdown-border": tokens.border,
    "--markdown-block-gap": `${tokens.blockGapPt}pt`,
    "--markdown-body-size": `${tokens.body.fontSizePt}pt`,
    "--markdown-body-line-height": String(tokens.body.lineHeight),
    "--markdown-lead-size": `${tokens.lead.fontSizePt}pt`,
    "--markdown-lead-line-height": `${tokens.lead.lineHeightPt}pt`,
    "--markdown-introduction-size": `${tokens.contexts.introduction.fontSizePt}pt`,
    "--markdown-introduction-line-height": `${tokens.contexts.introduction.lineHeightPt}pt`,
    "--markdown-activity-size": `${tokens.contexts.activity.fontSizePt}pt`,
    "--markdown-activity-line-height": `${tokens.contexts.activity.lineHeightPt}pt`,
    "--markdown-list-size": `${tokens.list.fontSizePt}pt`,
    "--markdown-list-line-height": `${tokens.list.lineHeightPt}pt`,
    "--markdown-list-gap": `${tokens.list.itemGapPt}pt`,
    "--markdown-code-font-family": tokens.code.fontFamily,
    "--markdown-code-size": `${tokens.code.fontSizePt}pt`,
    "--markdown-code-background": tokens.code.background,
    "--markdown-code-border": tokens.code.border,
    "--markdown-quote-border": tokens.quote.border,
    "--markdown-table-size": `${tokens.table.fontSizePt}pt`,
    "--markdown-table-border": tokens.table.border,
    "--markdown-table-header-background": tokens.table.headerBackground,
  };
  for (const level of [1, 2, 3, 4, 5, 6] as const) {
    const heading = tokens.headings[level];
    variables[`--markdown-h${level}-size`] = `${heading.fontSizePt}pt`;
    variables[`--markdown-h${level}-line-height`] = String(heading.lineHeight);
    variables[`--markdown-h${level}-weight`] = String(heading.fontWeight);
    variables[`--markdown-h${level}-color`] = heading.color;
    variables[`--markdown-project-h${level}-size`] = `${tokens.contexts.projectHeadings[level]}pt`;
  }
  return variables as CSSProperties;
}
