import type { CSSProperties } from "react";

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

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

export type ResumeStyleSheetInput = {
  id: string;
  name: string;
  className: string;
  page: {
    widthMm: number;
    heightMm: number;
  };
  projectTitle: MarkdownHeadingStyle;
  markdown: MarkdownStyleTokens;
};

export type RuntimeResumeStyleSheet = ResumeStyleSheetInput & {
  variables: CSSProperties;
};
