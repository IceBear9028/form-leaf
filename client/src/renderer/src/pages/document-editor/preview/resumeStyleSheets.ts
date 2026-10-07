import type { CSSProperties } from "react";

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type MarkdownHeadingStyle = {
  fontSizePt: number;
  lineHeight: number;
  fontWeight: number;
  color: string;
};

export type MarkdownStyleTokens = {
  fontFamily: string;
  text: string;
  secondaryText: string;
  mutedText: string;
  accent: string;
  border: string;
  blockGapPt: number;
  body: { fontSizePt: number; lineHeight: number };
  lead: { fontSizePt: number; lineHeightPt: number };
  contexts: {
    introduction: { fontSizePt: number; lineHeightPt: number };
    activity: { fontSizePt: number; lineHeightPt: number };
    projectHeadings: Record<HeadingLevel, number>;
  };
  headings: Record<HeadingLevel, MarkdownHeadingStyle>;
  list: {
    fontSizePt: number;
    lineHeightPt: number;
    itemGapPt: number;
  };
  code: { fontFamily: string; fontSizePt: number; background: string; border: string };
  quote: { border: string };
  table: { fontSizePt: number; border: string; headerBackground: string };
};

export type RuntimeResumeStyleSheet = {
  id: string;
  name: string;
  className: string;
  page: {
    widthMm: number;
    heightMm: number;
  };
  projectTitle: MarkdownHeadingStyle;
  markdown: MarkdownStyleTokens;
  variables: CSSProperties;
};

type ResumeStyleSheetInput = Omit<RuntimeResumeStyleSheet, "variables">;

const referenceMarkdown: MarkdownStyleTokens = {
  fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  text: "#000000",
  secondaryText: "#57606a",
  mutedText: "#6e7781",
  accent: "#0969da",
  border: "#d0d7de",
  blockGapPt: 8,
  body: { fontSizePt: 8, lineHeight: 1.57 },
  lead: { fontSizePt: 8, lineHeightPt: 12.5 },
  contexts: {
    introduction: { fontSizePt: 10, lineHeightPt: 16 },
    activity: { fontSizePt: 8, lineHeightPt: 10 },
    projectHeadings: {
      1: 12,
      2: 10.5,
      3: 9,
      4: 8,
      5: 7,
      6: 6.8,
    },
  },
  headings: {
    1: { fontSizePt: 16, lineHeight: 1.25, fontWeight: 600, color: "#000000" },
    2: { fontSizePt: 12, lineHeight: 1.25, fontWeight: 600, color: "#000000" },
    3: { fontSizePt: 10, lineHeight: 1.25, fontWeight: 600, color: "#000000" },
    4: { fontSizePt: 8, lineHeight: 1.25, fontWeight: 600, color: "#000000" },
    5: { fontSizePt: 7, lineHeight: 1.25, fontWeight: 600, color: "#000000" },
    6: { fontSizePt: 6.8, lineHeight: 1.25, fontWeight: 600, color: "#000000" },
  },
  list: {
    fontSizePt: 8,
    lineHeightPt: 12.5,
    itemGapPt: 1,
  },
  code: {
    fontFamily: '"SF Mono", Monaco, Menlo, Consolas, "Ubuntu Mono", "Liberation Mono", monospace',
    fontSizePt: 7.4,
    background: "#f6f8fa",
    border: "#d0d7de",
  },
  quote: { border: "#d0d7de" },
  table: { fontSizePt: 7.4, border: "#d0d7de", headerBackground: "transparent" },
};

const styleSheetInputs: ResumeStyleSheetInput[] = [
  {
    id: "reference-resume-v1",
    name: "참조 이력서",
    className: "resume-style-reference-v1",
    page: { widthMm: 210, heightMm: 297 },
    projectTitle: { fontSizePt: 13, lineHeight: 1.25, fontWeight: 700, color: "#0969da" },
    markdown: referenceMarkdown,
  },
  {
    id: "reference-resume-compact-v1",
    name: "참조 이력서 · 컴팩트",
    className: "resume-style-reference-v1",
    page: { widthMm: 210, heightMm: 297 },
    projectTitle: { fontSizePt: 12, lineHeight: 1.25, fontWeight: 700, color: "#0969da" },
    markdown: {
      ...referenceMarkdown,
      blockGapPt: 5.5,
      body: { fontSizePt: 7.5, lineHeight: 1.5 },
      lead: { fontSizePt: 7.5, lineHeightPt: 11.25 },
      contexts: {
        introduction: { fontSizePt: 9.2, lineHeightPt: 14 },
        activity: { fontSizePt: 7.5, lineHeightPt: 9.2 },
        projectHeadings: {
          1: 11,
          2: 10,
          3: 8.5,
          4: 7.5,
          5: 6.6,
          6: 6.4,
        },
      },
      headings: {
        ...referenceMarkdown.headings,
        1: { ...referenceMarkdown.headings[1], fontSizePt: 15 },
        2: { ...referenceMarkdown.headings[2], fontSizePt: 11.25 },
        3: { ...referenceMarkdown.headings[3], fontSizePt: 9.375 },
        4: { ...referenceMarkdown.headings[4], fontSizePt: 7.5 },
        5: { ...referenceMarkdown.headings[5], fontSizePt: 6.6 },
        6: { ...referenceMarkdown.headings[6], fontSizePt: 6.4 },
      },
      list: {
        ...referenceMarkdown.list,
        fontSizePt: 7.5,
        lineHeightPt: 11.25,
        itemGapPt: 0.75,
      },
      code: { ...referenceMarkdown.code, fontSizePt: 6.9 },
      table: { ...referenceMarkdown.table, fontSizePt: 6.9 },
    },
  },
];

const styleSheets = new Map(
  styleSheetInputs.map((input) => {
    const styleSheet: RuntimeResumeStyleSheet = Object.freeze({
      ...input,
      projectTitle: Object.freeze(input.projectTitle),
      markdown: Object.freeze(input.markdown),
      variables: styleSheetVariables(input),
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

function styleSheetVariables(styleSheet: ResumeStyleSheetInput): CSSProperties {
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
