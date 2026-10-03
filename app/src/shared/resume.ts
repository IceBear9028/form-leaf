export type TextMark = "strong" | "underline" | "link";

export type TextRun = {
  text: string;
  marks?: TextMark[];
  href?: string;
};

export type TextContent = {
  runs: TextRun[];
};

export type ResumeLink = {
  id: string;
  label: string;
  href: string;
};

export type DateRange = {
  start: string;
  end: string;
  label?: string;
};

export type ParagraphBlock = {
  id: string;
  type: "paragraph";
  styleRef: "body" | "item.summary";
  content: TextContent;
};

export type BulletListBlock = {
  id: string;
  type: "bullet-list";
  items: TextContent[];
};

export type DetailBlock = {
  id: string;
  type: "detail";
  title: TextContent;
  context: TextContent;
  actions: TextContent[];
  result: TextContent;
};

export type LinkListBlock = {
  id: string;
  type: "link-list";
  links: ResumeLink[];
};

export type TechStackBlock = {
  id: string;
  type: "tech-stack";
  items: string[];
};

export type ContentBlock =
  | ParagraphBlock
  | BulletListBlock
  | DetailBlock
  | LinkListBlock
  | TechStackBlock;

export type ProfileSection = {
  id: string;
  type: "profile";
  visible: boolean;
  role: string;
  name: string;
  phone: string;
  email: string;
  photoDataUrl?: string;
  links: ResumeLink[];
};

export type IntroductionSection = {
  id: string;
  type: "introduction";
  title: string;
  visible: boolean;
  paragraphs: Array<{ id: string; content: TextContent }>;
};

export type TimelineKind = "career" | "education" | "activity";

export type TimelineItem = {
  id: string;
  visible: boolean;
  period: DateRange;
  organization: string;
  title: TextContent;
  links: ResumeLink[];
  blocks: ContentBlock[];
};

export type TimelineSection = {
  id: string;
  type: "timeline";
  timelineKind: TimelineKind;
  title: string;
  annotation?: string;
  visible: boolean;
  items: TimelineItem[];
};

export type ProjectItem = {
  id: string;
  visible: boolean;
  order: number;
  period: DateRange;
  organization: string;
  title: TextContent;
  summary: TextContent;
  links: ResumeLink[];
  blocks: ContentBlock[];
};

export type ProjectGroupSection = {
  id: string;
  type: "project-group";
  groupKind: "project" | "side-project";
  title: string;
  visible: boolean;
  items: ProjectItem[];
};

export type FreeTextSection = {
  id: string;
  type: "free-text";
  title: string;
  visible: boolean;
  blocks: ContentBlock[];
};

export type ResumeSection =
  | ProfileSection
  | IntroductionSection
  | TimelineSection
  | ProjectGroupSection
  | FreeTextSection;

export type ResumeDocument = {
  schemaVersion: 1;
  documentId: string;
  name: string;
  styleSheetId: "reference-resume-v1";
  pagination: { mode: "multi-page" };
  sections: ResumeSection[];
  updatedAt: string;
};

export type PdfExportResult =
  | { canceled: true }
  | { canceled: false; filePath: string };

export type ResumeStudioApi = {
  loadDocument: () => Promise<ResumeDocument>;
  saveDocument: (document: ResumeDocument) => Promise<{ savedAt: string }>;
  exportPdf: (suggestedName: string) => Promise<PdfExportResult>;
  showInFolder: (filePath: string) => Promise<void>;
};

export const emptyText = (): TextContent => ({ runs: [{ text: "" }] });

export const plainText = (content: TextContent): string =>
  content.runs.map((run) => run.text).join("");

export const createId = (prefix = "item"): string =>
  `${prefix}-${crypto.randomUUID()}`;

export function createParagraphBlock(): ParagraphBlock {
  return {
    id: createId("paragraph"),
    type: "paragraph",
    styleRef: "body",
    content: emptyText(),
  };
}

export function createDefaultDocument(): ResumeDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    documentId: createId("resume"),
    name: "새 이력서",
    styleSheetId: "reference-resume-v1",
    pagination: { mode: "multi-page" },
    updatedAt: now,
    sections: [
      {
        id: createId("profile"),
        type: "profile",
        visible: true,
        role: "",
        name: "",
        phone: "",
        email: "",
        links: [],
      },
      {
        id: createId("introduction"),
        type: "introduction",
        title: "소개",
        visible: true,
        paragraphs: [],
      },
      {
        id: createId("career"),
        type: "timeline",
        timelineKind: "career",
        title: "경력",
        visible: true,
        items: [],
      },
      {
        id: createId("education"),
        type: "timeline",
        timelineKind: "education",
        title: "교육",
        visible: true,
        items: [],
      },
      {
        id: createId("projects"),
        type: "project-group",
        groupKind: "project",
        title: "프로젝트",
        visible: true,
        items: [],
      },
      {
        id: createId("side-projects"),
        type: "project-group",
        groupKind: "side-project",
        title: "사이드 프로젝트",
        visible: true,
        items: [],
      },
      {
        id: createId("activity"),
        type: "timeline",
        timelineKind: "activity",
        title: "대외활동",
        visible: true,
        items: [],
      },
      {
        id: createId("free-text"),
        type: "free-text",
        title: "추가 내용",
        visible: true,
        blocks: [],
      },
    ],
  };
}

export function isResumeDocument(value: unknown): value is ResumeDocument {
  if (!isRecord(value)) return false;
  const candidate = value as Partial<ResumeDocument>;
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.documentId === "string" &&
    typeof candidate.name === "string" &&
    candidate.styleSheetId === "reference-resume-v1" &&
    isRecord(candidate.pagination) &&
    candidate.pagination.mode === "multi-page" &&
    typeof candidate.updatedAt === "string" &&
    Array.isArray(candidate.sections) &&
    candidate.sections.every(isResumeSection)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isString(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isTextContent(value: unknown): value is TextContent {
  if (!isRecord(value) || !Array.isArray(value.runs)) return false;
  return value.runs.every((run) => {
    if (!isRecord(run) || !isString(run.text)) return false;
    if (run.href !== undefined && !isString(run.href)) return false;
    if (run.marks === undefined) return true;
    return Array.isArray(run.marks) && run.marks.every((mark) =>
      mark === "strong" || mark === "underline" || mark === "link",
    );
  });
}

function isResumeLink(value: unknown): value is ResumeLink {
  return isRecord(value) && isString(value.id) && isString(value.label) && isString(value.href);
}

function isLinkArray(value: unknown): value is ResumeLink[] {
  return Array.isArray(value) && value.every(isResumeLink);
}

function isDateRange(value: unknown): value is DateRange {
  return (
    isRecord(value) &&
    isString(value.start) &&
    isString(value.end) &&
    isOptionalString(value.label)
  );
}

function isContentBlock(value: unknown): value is ContentBlock {
  if (!isRecord(value) || !isString(value.id) || !isString(value.type)) return false;
  if (value.type === "paragraph") {
    return (
      (value.styleRef === "body" || value.styleRef === "item.summary") &&
      isTextContent(value.content)
    );
  }
  if (value.type === "bullet-list") {
    return Array.isArray(value.items) && value.items.every(isTextContent);
  }
  if (value.type === "detail") {
    return (
      isTextContent(value.title) &&
      isTextContent(value.context) &&
      Array.isArray(value.actions) &&
      value.actions.every(isTextContent) &&
      isTextContent(value.result)
    );
  }
  if (value.type === "link-list") return isLinkArray(value.links);
  if (value.type === "tech-stack") return isStringArray(value.items);
  return false;
}

function isBlockArray(value: unknown): value is ContentBlock[] {
  return Array.isArray(value) && value.every(isContentBlock);
}

function hasSectionBase(value: Record<string, unknown>): boolean {
  return isString(value.id) && typeof value.visible === "boolean";
}

function isTimelineItem(value: unknown): value is TimelineItem {
  return (
    isRecord(value) &&
    isString(value.id) &&
    typeof value.visible === "boolean" &&
    isDateRange(value.period) &&
    isString(value.organization) &&
    isTextContent(value.title) &&
    isLinkArray(value.links) &&
    isBlockArray(value.blocks)
  );
}

function isProjectItem(value: unknown): value is ProjectItem {
  return (
    isRecord(value) &&
    isString(value.id) &&
    typeof value.visible === "boolean" &&
    typeof value.order === "number" &&
    Number.isFinite(value.order) &&
    isDateRange(value.period) &&
    isString(value.organization) &&
    isTextContent(value.title) &&
    isTextContent(value.summary) &&
    isLinkArray(value.links) &&
    isBlockArray(value.blocks)
  );
}

function isResumeSection(value: unknown): value is ResumeSection {
  if (!isRecord(value) || !hasSectionBase(value) || !isString(value.type)) return false;
  if (value.type === "profile") {
    return (
      isString(value.role) &&
      isString(value.name) &&
      isString(value.phone) &&
      isString(value.email) &&
      isOptionalString(value.photoDataUrl) &&
      isLinkArray(value.links)
    );
  }
  if (value.type === "introduction") {
    return (
      isString(value.title) &&
      Array.isArray(value.paragraphs) &&
      value.paragraphs.every((paragraph) =>
        isRecord(paragraph) && isString(paragraph.id) && isTextContent(paragraph.content),
      )
    );
  }
  if (value.type === "timeline") {
    return (
      (value.timelineKind === "career" || value.timelineKind === "education" || value.timelineKind === "activity") &&
      isString(value.title) &&
      isOptionalString(value.annotation) &&
      Array.isArray(value.items) &&
      value.items.every(isTimelineItem)
    );
  }
  if (value.type === "project-group") {
    return (
      (value.groupKind === "project" || value.groupKind === "side-project") &&
      isString(value.title) &&
      Array.isArray(value.items) &&
      value.items.every(isProjectItem)
    );
  }
  if (value.type === "free-text") {
    return isString(value.title) && isBlockArray(value.blocks);
  }
  return false;
}
