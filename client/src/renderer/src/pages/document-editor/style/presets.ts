import type { MarkdownStyleTokens, ResumeStyleSheetInput } from "./schema.ts";

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

export const resumeStyleSheetPresets: ResumeStyleSheetInput[] = [
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
