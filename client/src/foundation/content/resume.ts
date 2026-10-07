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

/** schemaVersion 1에서만 사용하는 레거시 본문 블록이다. */
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
  bodyMarkdown: string;
};

export type TimelineKind = "career" | "education" | "activity";

export type TimelineItem = {
  id: string;
  visible: boolean;
  period: DateRange;
  organization: string;
  title: TextContent;
  links: ResumeLink[];
  bodyMarkdown: string;
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
  links: ResumeLink[];
  techStack: string[];
  bodyMarkdown: string;
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
  bodyMarkdown: string;
};

export type ResumeSection =
  | ProfileSection
  | IntroductionSection
  | TimelineSection
  | ProjectGroupSection
  | FreeTextSection;

export type ResumeDocument = {
  schemaVersion: 2;
  documentId: string;
  name: string;
  styleSheetId: string;
  pagination: { mode: "multi-page" };
  sections: ResumeSection[];
  updatedAt: string;
};

export type V1IntroductionSection = Omit<IntroductionSection, "bodyMarkdown"> & {
  paragraphs: Array<{ id: string; content: TextContent }>;
};

export type V1TimelineItem = Omit<TimelineItem, "bodyMarkdown"> & {
  blocks: ContentBlock[];
};

export type V1TimelineSection = Omit<TimelineSection, "items"> & {
  items: V1TimelineItem[];
};

export type V1ProjectItem = Omit<ProjectItem, "bodyMarkdown" | "techStack"> & {
  summary: TextContent;
  blocks: ContentBlock[];
};

export type V1ProjectGroupSection = Omit<ProjectGroupSection, "items"> & {
  items: V1ProjectItem[];
};

export type V1FreeTextSection = Omit<FreeTextSection, "bodyMarkdown"> & {
  blocks: ContentBlock[];
};

export type V1ResumeSection =
  | ProfileSection
  | V1IntroductionSection
  | V1TimelineSection
  | V1ProjectGroupSection
  | V1FreeTextSection;

export type V1ResumeDocument = Omit<ResumeDocument, "schemaVersion" | "sections"> & {
  schemaVersion: 1;
  styleSheetId: "reference-resume-v1";
  sections: V1ResumeSection[];
};

export type PdfExportResult =
  | { canceled: true }
  | { canceled: false; filePath: string };

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
    schemaVersion: 2,
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
        bodyMarkdown: "",
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
        bodyMarkdown: "",
      },
    ],
  };
}

export function isResumeDocument(value: unknown): value is ResumeDocument {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === 2 &&
    isDocumentBase(value) &&
    Array.isArray(value.sections) &&
    value.sections.every(isResumeSection)
  );
}

export function isV1ResumeDocument(value: unknown): value is V1ResumeDocument {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === 1 &&
    value.styleSheetId === "reference-resume-v1" &&
    isDocumentBase(value) &&
    Array.isArray(value.sections) &&
    value.sections.every(isV1ResumeSection)
  );
}

function isDocumentBase(value: Record<string, unknown>): boolean {
  return (
    isString(value.documentId) &&
    isString(value.name) &&
    isNonEmptyString(value.styleSheetId) &&
    isRecord(value.pagination) &&
    value.pagination.mode === "multi-page" &&
    isString(value.updatedAt)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
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

function isProfileSection(value: unknown): value is ProfileSection {
  return (
    isRecord(value) &&
    hasSectionBase(value) &&
    value.type === "profile" &&
    isString(value.role) &&
    isString(value.name) &&
    isString(value.phone) &&
    isString(value.email) &&
    isOptionalString(value.photoDataUrl) &&
    isLinkArray(value.links)
  );
}

function isTimelineItem(value: unknown): value is TimelineItem {
  return (
    isTimelineItemBase(value) &&
    isString(value.bodyMarkdown)
  );
}

function isProjectItem(value: unknown): value is ProjectItem {
  return (
    isProjectItemBase(value) &&
    isStringArray(value.techStack) &&
    isString(value.bodyMarkdown)
  );
}

function isResumeSection(value: unknown): value is ResumeSection {
  if (isProfileSection(value)) return true;
  if (!isRecord(value) || !hasSectionBase(value) || !isString(value.type)) return false;
  if (value.type === "introduction") {
    return isString(value.title) && isString(value.bodyMarkdown);
  }
  if (value.type === "timeline") {
    return isTimelineSectionBase(value) && value.items.every(isTimelineItem);
  }
  if (value.type === "project-group") {
    return isProjectSectionBase(value) && value.items.every(isProjectItem);
  }
  if (value.type === "free-text") {
    return isString(value.title) && isString(value.bodyMarkdown);
  }
  return false;
}

function isV1ResumeSection(value: unknown): value is V1ResumeSection {
  if (isProfileSection(value)) return true;
  if (!isRecord(value) || !hasSectionBase(value) || !isString(value.type)) return false;
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
    return isTimelineSectionBase(value) && value.items.every((item) =>
      isTimelineItemBase(item) && isBlockArray(item.blocks),
    );
  }
  if (value.type === "project-group") {
    return isProjectSectionBase(value) && value.items.every((item) =>
      isProjectItemBase(item) && isTextContent(item.summary) && isBlockArray(item.blocks),
    );
  }
  if (value.type === "free-text") {
    return isString(value.title) && isBlockArray(value.blocks);
  }
  return false;
}

function isTimelineItemBase(value: unknown): value is Record<string, unknown> & Omit<TimelineItem, "bodyMarkdown"> {
  return (
    isRecord(value) &&
    isString(value.id) &&
    typeof value.visible === "boolean" &&
    isDateRange(value.period) &&
    isString(value.organization) &&
    isTextContent(value.title) &&
    isLinkArray(value.links)
  );
}

function isProjectItemBase(value: unknown): value is Record<string, unknown> & Omit<ProjectItem, "bodyMarkdown" | "techStack"> {
  return (
    isTimelineItemBase(value) &&
    typeof value.order === "number" &&
    Number.isFinite(value.order)
  );
}

function isTimelineSectionBase(value: Record<string, unknown>): value is Record<string, unknown> & Omit<TimelineSection, "items"> & { items: unknown[] } {
  return (
    (value.timelineKind === "career" || value.timelineKind === "education" || value.timelineKind === "activity") &&
    isString(value.title) &&
    isOptionalString(value.annotation) &&
    Array.isArray(value.items)
  );
}

function isProjectSectionBase(value: Record<string, unknown>): value is Record<string, unknown> & Omit<ProjectGroupSection, "items"> & { items: unknown[] } {
  return (
    (value.groupKind === "project" || value.groupKind === "side-project") &&
    isString(value.title) &&
    Array.isArray(value.items)
  );
}

function hasSectionBase(value: Record<string, unknown>): boolean {
  return isString(value.id) && typeof value.visible === "boolean";
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
