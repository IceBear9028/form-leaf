import type {
  ComponentDefinition,
  ComponentPropDefinition,
  ComponentPropValue,
  DocumentData,
  DocumentNode,
  RichTextMark,
  RichTextValue,
  StyleDefinition,
} from "../../../foundation/documentModel.ts";
import { DOCUMENT_SCHEMA_VERSION } from "../../../foundation/documentModel.ts";
import { validateDocumentData } from "../../../foundation/documentValidation.ts";
import {
  isLegacyV1Document,
  isLegacyV2Document,
  type LegacyLink,
  type LegacyProfileSection,
  type LegacyProjectGroupSection,
  type LegacyProjectItem,
  type LegacySection,
  type LegacyTextContent,
  type LegacyTimelineItem,
  type LegacyTimelineSection,
  type LegacyV2Document,
} from "./legacySchema.ts";
import { migrateLegacyV1 } from "./migrateLegacyV1.ts";

export class LegacyDocumentImportError extends Error {
  readonly path: string;

  constructor(
    path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = "LegacyDocumentImportError";
    this.path = path;
  }
}

export function importLegacyDocument(value: unknown): DocumentData {
  const source = readLegacyDocument(value);
  const builder = new LegacyDocumentBuilder(source);
  source.sections.forEach((section, index) => builder.addSection(section, index));
  const document = builder.finish();
  const validation = validateDocumentData(document);
  if (!validation.valid) {
    const first = validation.issues[0];
    throw new LegacyDocumentImportError(
      first?.path ?? "$",
      first?.message ?? "범용 문서로 변환하지 못했습니다.",
    );
  }
  return document;
}

function readLegacyDocument(value: unknown): LegacyV2Document {
  if (isLegacyV2Document(value)) return value;
  if (isLegacyV1Document(value)) return migrateLegacyV1(value);
  throw new LegacyDocumentImportError("$", "지원하는 v1 또는 v2 문서가 아닙니다.");
}

class LegacyDocumentBuilder {
  private readonly ids = new IdAllocator();
  private readonly rootNodeId = this.ids.create("node", "root");
  private readonly rootStyleId = this.ids.create("style", "root");
  private readonly sectionStyleId = this.ids.create("style", "section");
  private readonly sectionBoundaryStyleId = this.ids.create("style", "section-boundary");
  private readonly itemStyleId = this.ids.create("style", "item");
  private readonly headingStyleId = this.ids.create("style", "heading");
  private readonly headingRowStyleId = this.ids.create("style", "heading-row");
  private readonly annotationStyleId = this.ids.create("style", "annotation");
  private readonly leadStyleId = this.ids.create("style", "lead");
  private readonly listStyleId = this.ids.create("style", "list");
  private readonly metaStyleId = this.ids.create("style", "meta");
  private readonly contentStyleId = this.ids.create("style", "content");
  private readonly titleStyleId = this.ids.create("style", "title");
  private readonly accentTitleStyleId = this.ids.create("style", "accent-title");
  private readonly compactTextStyleId = this.ids.create("style", "compact-text");
  private readonly headerRowStyleId = this.ids.create("style", "header-row");
  private readonly mediaStyleId = this.ids.create("style", "media");
  private readonly identityStyleId = this.ids.create("style", "identity");
  private readonly roleStyleId = this.ids.create("style", "role");
  private readonly nameStyleId = this.ids.create("style", "name");
  private readonly asideStyleId = this.ids.create("style", "aside");
  private readonly contactRowStyleId = this.ids.create("style", "contact-row");
  private readonly contactLabelStyleId = this.ids.create("style", "contact-label");
  private readonly contactValueStyleId = this.ids.create("style", "contact-value");
  private readonly document: DocumentData;

  constructor(source: LegacyV2Document) {
    const compact = source.styleSheetId === "reference-resume-compact-v1";
    this.document = {
      schemaVersion: DOCUMENT_SCHEMA_VERSION,
      documentId: source.documentId,
      name: source.name,
      rootNodeId: this.rootNodeId,
      nodes: {
        [this.rootNodeId]: {
          id: this.rootNodeId,
          type: "container",
          name: "Root",
          visible: true,
          styleId: this.rootStyleId,
          childIds: [],
        },
      },
      components: {},
      styles: this.createStyles(compact),
      assets: {},
      updatedAt: source.updatedAt,
    };
  }

  addSection(section: LegacySection, sectionIndex: number): void {
    if (section.type === "profile") {
      this.addProfile(section, sectionIndex);
      return;
    }
    if (section.type === "introduction" || section.type === "free-text") {
      this.addMarkdownSection(section, sectionIndex);
      return;
    }
    if (section.type === "timeline") {
      this.addTimeline(section, sectionIndex);
      return;
    }
    this.addProjectGroup(section, sectionIndex);
  }

  finish(): DocumentData {
    return this.document;
  }

  private createStyles(compact: boolean): Record<string, StyleDefinition> {
    const bodySize = compact ? 7.5 : 8;
    const sectionGap = compact ? 9 : 12;
    return {
      [this.rootStyleId]: {
        id: this.rootStyleId,
        name: "Document",
        layout: {
          direction: "column",
          gapPt: compact ? 10 : 13,
          align: "stretch",
          width: { mode: "fill" },
        },
        typography: {
          fontFamily: "Pretendard",
          fontSizePt: bodySize,
          lineHeight: compact ? 1.5 : 1.57,
          fontWeight: 400,
          color: { kind: "hex", value: "#000000" },
        },
      },
      [this.sectionStyleId]: {
        id: this.sectionStyleId,
        name: "Section",
        layout: { direction: "column", gapPt: sectionGap, align: "stretch", width: { mode: "fill" } },
      },
      [this.sectionBoundaryStyleId]: {
        id: this.sectionBoundaryStyleId,
        name: "Section with rule",
        layout: {
          direction: "column",
          gapPt: sectionGap,
          paddingPt: [compact ? 14 : 18, 0, 0, 0],
          align: "stretch",
          width: { mode: "fill" },
        },
        decoration: {
          borderColor: { kind: "hex", value: "#D9D9D9" },
          borderWidthPt: 0.75,
          borderEdges: ["top"],
        },
      },
      [this.itemStyleId]: {
        id: this.itemStyleId,
        name: "Item",
        layout: { direction: "row", gapPt: 0, align: "start", width: { mode: "fill" } },
        pagination: { keepTogether: true },
      },
      [this.headingStyleId]: {
        id: this.headingStyleId,
        name: "Heading",
        typography: {
          fontSizePt: compact ? 17 : 18,
          lineHeight: 1.2,
          fontWeight: 760,
          color: { kind: "hex", value: "#222222" },
        },
        pagination: { keepWithNext: true },
      },
      [this.headingRowStyleId]: {
        id: this.headingRowStyleId,
        name: "Heading row",
        layout: { direction: "row", gapPt: 5.5, align: "end", width: { mode: "fill" } },
        pagination: { keepWithNext: true },
      },
      [this.annotationStyleId]: {
        id: this.annotationStyleId,
        name: "Annotation",
        typography: { fontSizePt: 10, lineHeight: 1.2, fontWeight: 700, color: { kind: "hex", value: "#34383E" } },
      },
      [this.leadStyleId]: {
        id: this.leadStyleId,
        name: "Lead",
        typography: { fontSizePt: compact ? 9.2 : 10, lineHeight: compact ? 1.52 : 1.6, color: { kind: "hex", value: "#222222" } },
      },
      [this.listStyleId]: {
        id: this.listStyleId,
        name: "Item list",
        layout: { direction: "column", gapPt: compact ? 10 : 13, align: "stretch", width: { mode: "fill" } },
      },
      [this.metaStyleId]: {
        id: this.metaStyleId,
        name: "Meta column",
        layout: { direction: "column", gapPt: 0, align: "start", width: { mode: "fixed", valuePt: 88 } },
        typography: { fontSizePt: 8, lineHeight: 1.75, fontWeight: 600, color: { kind: "hex", value: "#5E6671" } },
      },
      [this.contentStyleId]: {
        id: this.contentStyleId,
        name: "Content column",
        layout: { direction: "column", gapPt: compact ? 4.5 : 6, paddingPt: [0, 0, 0, 23], width: { mode: "fill" }, grow: 1 },
        decoration: { borderColor: { kind: "hex", value: "#D9D9D9" }, borderWidthPt: 0.75, borderEdges: ["left"] },
      },
      [this.titleStyleId]: {
        id: this.titleStyleId,
        name: "Item title",
        typography: { fontSizePt: 10, lineHeight: 1.2, fontWeight: 740, color: { kind: "hex", value: "#222222" } },
      },
      [this.accentTitleStyleId]: {
        id: this.accentTitleStyleId,
        name: "Accent title",
        typography: { fontSizePt: compact ? 12 : 13, lineHeight: 1.25, fontWeight: 700, color: { kind: "hex", value: "#0969DA" } },
      },
      [this.compactTextStyleId]: {
        id: this.compactTextStyleId,
        name: "Compact text",
        typography: { fontSizePt: compact ? 7.5 : 8, lineHeight: 1.35, color: { kind: "hex", value: "#34383E" } },
      },
      [this.headerRowStyleId]: {
        id: this.headerRowStyleId,
        name: "Header row",
        layout: { direction: "row", gapPt: 16, align: "center", width: { mode: "fill" }, paddingPt: [0, 0, compact ? 13 : 16, 0] },
        pagination: { keepTogether: true, keepWithNext: true },
      },
      [this.mediaStyleId]: {
        id: this.mediaStyleId,
        name: "Media",
        layout: { width: { mode: "fixed", valuePt: 58 }, heightPt: 58 },
        decoration: { background: { kind: "hex", value: "#EEF1F4" }, radiusPt: 29 },
      },
      [this.identityStyleId]: {
        id: this.identityStyleId,
        name: "Identity",
        layout: { direction: "column", gapPt: 4.5, width: { mode: "fill" }, grow: 1 },
      },
      [this.roleStyleId]: {
        id: this.roleStyleId,
        name: "Role",
        typography: { fontSizePt: 12, lineHeight: 1.2, fontWeight: 700, color: { kind: "hex", value: "#2B77EC" } },
      },
      [this.nameStyleId]: {
        id: this.nameStyleId,
        name: "Name",
        typography: { fontSizePt: 16, lineHeight: 1.15, fontWeight: 760, color: { kind: "hex", value: "#222222" } },
      },
      [this.asideStyleId]: {
        id: this.asideStyleId,
        name: "Aside",
        layout: { direction: "column", gapPt: 8, paddingPt: [0.6, 0, 0, 16], width: { mode: "fixed", valuePt: 187 } },
        decoration: { borderColor: { kind: "hex", value: "#D9D9D9" }, borderWidthPt: 0.75, borderEdges: ["left"] },
      },
      [this.contactRowStyleId]: {
        id: this.contactRowStyleId,
        name: "Label row",
        layout: { direction: "row", gapPt: 4, align: "start", width: { mode: "fill" } },
        typography: { fontSizePt: 8, lineHeight: 1.25 },
      },
      [this.contactLabelStyleId]: {
        id: this.contactLabelStyleId,
        name: "Label",
        layout: { width: { mode: "fixed", valuePt: 40 } },
        typography: { fontSizePt: 8, lineHeight: 1.25, fontWeight: 720, color: { kind: "hex", value: "#22262B" } },
      },
      [this.contactValueStyleId]: {
        id: this.contactValueStyleId,
        name: "Value",
        layout: { width: { mode: "fill" }, grow: 1 },
        typography: { fontSizePt: 8, lineHeight: 1.25, fontWeight: 590, color: { kind: "hex", value: "#343A43" } },
      },
    };
  }

  private addProfile(section: LegacyProfileSection, sectionIndex: number): void {
    const containerId = this.ids.create("node", `${section.id}-${sectionIndex}`);
    this.addChild(this.rootNodeId, {
      id: containerId,
      type: "container",
      name: "Header",
      visible: section.visible,
      styleId: this.headerRowStyleId,
      childIds: [],
    });
    if (section.photoDataUrl) {
      const parsed = parseImageDataUrl(section.photoDataUrl, `$.sections.${sectionIndex}.photoDataUrl`);
      const assetId = this.ids.create("asset", section.id);
      this.document.assets[assetId] = {
        id: assetId,
        type: "image",
        name: "Image",
        mimeType: parsed.mimeType,
        dataUrl: section.photoDataUrl,
      };
      this.addChild(containerId, {
        id: this.ids.create("node", `${section.id}-image`),
        type: "image",
        name: "Image",
        visible: true,
        styleId: this.mediaStyleId,
        assetId,
        alt: section.name,
      });
    }
    const identityId = this.addContainerChild(containerId, `${section.id}-identity`, "Identity", this.identityStyleId);
    this.addTextChild(identityId, `${section.id}-role`, "Role", section.role, this.roleStyleId);
    this.addTextChild(identityId, `${section.id}-name`, "Name", section.name, this.nameStyleId);

    const contactsId = this.addContainerChild(containerId, `${section.id}-contacts`, "Contacts", this.asideStyleId);
    this.addLabeledText(contactsId, `${section.id}-phone`, "Phone", section.phone);
    this.addLabeledText(contactsId, `${section.id}-email`, "Email", section.email);
    if (section.links.length) {
      const rowId = this.addContainerChild(contactsId, `${section.id}-links-row`, "Links", this.contactRowStyleId);
      this.addTextChild(rowId, `${section.id}-links-label`, "Label", "WebSite", this.contactLabelStyleId);
      this.addMarkdownChild(
        rowId,
        `${section.id}-links`,
        "Links",
        linksToInlineMarkdown(section.links),
        this.contactValueStyleId,
      );
    }
  }

  private addMarkdownSection(
    section: Extract<LegacySection, { type: "introduction" | "free-text" }>,
    sectionIndex: number,
  ): void {
    const containerId = this.addSectionContainer(section.id, sectionIndex, section.title, section.visible);
    this.addSectionHeader(containerId, `${section.id}-heading`, section.title);
    this.addMarkdownChild(
      containerId,
      `${section.id}-body`,
      "Body",
      section.bodyMarkdown,
      section.type === "introduction" ? this.leadStyleId : undefined,
    );
  }

  private addTimeline(section: LegacyTimelineSection, sectionIndex: number): void {
    const containerId = this.addSectionContainer(section.id, sectionIndex, section.title, section.visible);
    this.addSectionHeader(containerId, `${section.id}-heading`, section.title, section.annotation);
    const component = this.createTimelineComponent(section);
    const repeaterId = this.ids.create("node", `${section.id}-items`);
    this.addChild(containerId, {
      id: repeaterId,
      type: "repeater",
      name: `${section.title} items`,
      visible: true,
      styleId: this.listStyleId,
      itemComponentId: component.id,
      items: section.items.map((item, itemIndex) => ({
        id: this.ids.create("item", `${section.id}-${item.id}-${itemIndex}`),
        componentId: component.id,
        visible: item.visible,
        props: timelineProps(item),
      })),
    });
  }

  private addProjectGroup(section: LegacyProjectGroupSection, sectionIndex: number): void {
    const containerId = this.addSectionContainer(section.id, sectionIndex, section.title, section.visible);
    this.addSectionHeader(containerId, `${section.id}-heading`, section.title);
    const component = this.createProjectComponent(section);
    this.addChild(containerId, {
      id: this.ids.create("node", `${section.id}-items`),
      type: "repeater",
      name: `${section.title} items`,
      visible: true,
      styleId: this.listStyleId,
      itemComponentId: component.id,
      items: section.items.map((item, itemIndex) => ({
        id: this.ids.create("item", `${section.id}-${item.id}-${itemIndex}`),
        componentId: component.id,
        visible: item.visible,
        props: projectProps(item),
      })),
    });
  }

  private createTimelineComponent(section: LegacyTimelineSection): ComponentDefinition {
    return this.createItemComponent(section.id, `${section.title} item`, false, true, [
      textField("period-start", "Start", ""),
      textField("period-end", "End", ""),
      textField("period-label", "Period label", ""),
      textField("organization", "Organization", ""),
      richTextField("title", "Title", emptyRichText()),
      markdownField("links", "Links", ""),
      markdownField("body", "Body", ""),
    ]);
  }

  private createProjectComponent(section: LegacyProjectGroupSection): ComponentDefinition {
    return this.createItemComponent(section.id, `${section.title} item`, true, false, [
      textField("period-start", "Start", ""),
      textField("period-end", "End", ""),
      textField("period-label", "Period label", ""),
      textField("organization", "Organization", ""),
      richTextField("title", "Title", emptyRichText()),
      markdownField("links", "Links", ""),
      markdownField("tags", "Tags", ""),
      markdownField("body", "Body", ""),
    ]);
  }

  private createItemComponent(
    sourceId: string,
    name: string,
    accentTitle: boolean,
    organizationInContent: boolean,
    fields: LegacyComponentField[],
  ): ComponentDefinition {
    const componentId = this.ids.create("component", sourceId);
    const rootNodeId = this.ids.create("node", `${sourceId}-item-root`);
    const root: DocumentNode = {
      id: rootNodeId,
      type: "container",
      name,
      visible: true,
      styleId: this.itemStyleId,
      childIds: [],
    };
    this.document.nodes[rootNodeId] = root;
    const metaId = this.ids.create("node", `${sourceId}-item-meta`);
    const contentId = this.ids.create("node", `${sourceId}-item-content`);
    this.document.nodes[metaId] = {
      id: metaId,
      type: "container",
      name: "Meta",
      visible: true,
      styleId: this.metaStyleId,
      childIds: [],
    };
    this.document.nodes[contentId] = {
      id: contentId,
      type: "container",
      name: "Content",
      visible: true,
      styleId: this.contentStyleId,
      childIds: [],
    };
    root.childIds.push(metaId, contentId);
    const periodId = this.ids.create("node", `${sourceId}-item-period`);
    this.document.nodes[periodId] = {
      id: periodId,
      type: "container",
      name: "Period",
      visible: true,
      styleId: this.contactRowStyleId,
      childIds: [],
    };
    const meta = this.document.nodes[metaId];
    if (meta.type !== "container") throw new LegacyDocumentImportError("$", "meta column이 container가 아닙니다.");
    meta.childIds.push(periodId);
    const propDefinitions: ComponentPropDefinition[] = fields.map((field) => {
      const nodeId = this.ids.create("node", `${sourceId}-${field.id}`);
      const node = field.createNode(nodeId);
      const styleId = field.id === "organization" && organizationInContent
        ? this.titleStyleId
        : field.id === "title"
          ? accentTitle ? this.accentTitleStyleId : this.compactTextStyleId
        : field.id === "body" || field.id === "tags" || field.id === "links"
          ? this.compactTextStyleId
          : undefined;
      if (styleId) node.styleId = styleId;
      this.document.nodes[nodeId] = node;
      const column = field.id === "period-start" || field.id === "period-end"
        ? this.document.nodes[periodId]
        : ["period-label", "links"].includes(field.id) || (field.id === "organization" && !organizationInContent)
          ? this.document.nodes[metaId]
          : this.document.nodes[contentId];
      if (column.type !== "container") throw new LegacyDocumentImportError("$", "item column이 container가 아닙니다.");
      if (field.id === "period-end" && column.childIds.length) {
        const separatorId = this.ids.create("node", `${sourceId}-period-separator`);
        this.document.nodes[separatorId] = {
          id: separatorId,
          type: "text",
          name: "Separator",
          visible: true,
          value: "~",
        };
        column.childIds.push(separatorId);
      }
      column.childIds.push(nodeId);
      return {
        id: field.id,
        name: field.name,
        status: "active",
        valueType: field.valueType,
        binding: { nodeId, property: field.bindingProperty } as ComponentPropDefinition["binding"],
        defaultValue: field.defaultValue,
      };
    });
    const component: ComponentDefinition = {
      id: componentId,
      name,
      rootNodeId,
      propDefinitions,
    };
    this.document.components[componentId] = component;
    return component;
  }

  private addSectionContainer(
    sourceId: string,
    sectionIndex: number,
    name: string,
    visible: boolean,
  ): string {
    const id = this.ids.create("node", `${sourceId}-${sectionIndex}`);
    this.addChild(this.rootNodeId, {
      id,
      type: "container",
      name,
      visible,
      styleId: sectionIndex <= 1 ? this.sectionStyleId : this.sectionBoundaryStyleId,
      childIds: [],
    });
    return id;
  }

  private addSectionHeader(parentId: string, sourceId: string, value: string, annotation?: string): void {
    const rowId = this.addContainerChild(parentId, `${sourceId}-row`, "Heading row", this.headingRowStyleId);
    this.addTextChild(rowId, sourceId, "Heading", value, this.headingStyleId);
    if (annotation !== undefined) {
      this.addTextChild(rowId, `${sourceId}-annotation`, "Annotation", annotation, this.annotationStyleId);
    }
  }

  private addTextChild(parentId: string, sourceId: string, name: string, value: string, styleId?: string): void {
    const id = this.ids.create("node", sourceId);
    this.addChild(parentId, { id, type: "text", name, visible: true, ...(styleId ? { styleId } : {}), value });
  }

  private addMarkdownChild(parentId: string, sourceId: string, name: string, source: string, styleId?: string): void {
    const id = this.ids.create("node", sourceId);
    this.addChild(parentId, { id, type: "markdown", name, visible: true, ...(styleId ? { styleId } : {}), source });
  }

  private addContainerChild(parentId: string, sourceId: string, name: string, styleId: string): string {
    const id = this.ids.create("node", sourceId);
    this.addChild(parentId, { id, type: "container", name, visible: true, styleId, childIds: [] });
    return id;
  }

  private addLabeledText(parentId: string, sourceId: string, label: string, value: string): void {
    const rowId = this.addContainerChild(parentId, `${sourceId}-row`, label, this.contactRowStyleId);
    this.addTextChild(rowId, `${sourceId}-label`, "Label", label, this.contactLabelStyleId);
    this.addTextChild(rowId, sourceId, "Value", value, this.contactValueStyleId);
  }

  private addChild(parentId: string, node: DocumentNode): void {
    const parent = this.document.nodes[parentId];
    if (!parent || parent.type !== "container") {
      throw new LegacyDocumentImportError("$", `container를 찾을 수 없습니다: ${parentId}`);
    }
    this.document.nodes[node.id] = node;
    parent.childIds.push(node.id);
  }
}

type LegacyComponentField = {
  id: string;
  name: string;
  valueType: ComponentPropDefinition["valueType"];
  bindingProperty: ComponentPropDefinition["binding"]["property"];
  defaultValue: ComponentPropValue;
  createNode: (id: string) => DocumentNode;
};

function textField(id: string, name: string, defaultValue: string): LegacyComponentField {
  return {
    id,
    name,
    valueType: "text",
    bindingProperty: "text.value",
    defaultValue,
    createNode: (nodeId) => ({ id: nodeId, type: "text", name, visible: true, value: defaultValue }),
  };
}

function richTextField(id: string, name: string, defaultValue: RichTextValue): LegacyComponentField {
  return {
    id,
    name,
    valueType: "rich-text",
    bindingProperty: "rich-text.value",
    defaultValue,
    createNode: (nodeId) => ({ id: nodeId, type: "rich-text", name, visible: true, value: defaultValue }),
  };
}

function markdownField(id: string, name: string, defaultValue: string): LegacyComponentField {
  return {
    id,
    name,
    valueType: "markdown",
    bindingProperty: "markdown.source",
    defaultValue,
    createNode: (nodeId) => ({ id: nodeId, type: "markdown", name, visible: true, source: defaultValue }),
  };
}

function timelineProps(item: LegacyTimelineItem): Record<string, ComponentPropValue> {
  return {
    "period-start": item.period.start,
    "period-end": item.period.end,
    "period-label": item.period.label ?? "",
    organization: item.organization,
    title: toRichText(item.title),
    links: linksToInlineMarkdown(item.links),
    body: item.bodyMarkdown,
  };
}

function projectProps(item: LegacyProjectItem): Record<string, ComponentPropValue> {
  return {
    ...timelineProps(item),
    tags: inlineListToMarkdown(item.techStack),
  };
}

function toRichText(content: LegacyTextContent): RichTextValue {
  return {
    runs: content.runs.map((run) => {
      const marks: RichTextMark[] = [];
      if (run.marks?.includes("strong")) marks.push({ type: "bold" });
      if (run.marks?.includes("underline")) marks.push({ type: "underline" });
      if (run.marks?.includes("link") && run.href) marks.push({ type: "link", href: run.href });
      return { text: run.text, ...(marks.length ? { marks } : {}) };
    }),
  };
}

function emptyRichText(): RichTextValue {
  return { runs: [{ text: "" }] };
}

function linksToInlineMarkdown(links: LegacyLink[]): string {
  return links.map((link) => `[${escapeMarkdownText(link.label)}](<${escapeMarkdownUrl(link.href)}>)`).join(" · ");
}

function inlineListToMarkdown(items: string[]): string {
  return items.map(escapeMarkdownText).join(" · ");
}

function escapeMarkdownText(value: string): string {
  return value.replace(/[\\`*_[\]{}()#+.!|>-]/g, "\\$&");
}

function escapeMarkdownUrl(value: string): string {
  return value.replace(/</g, "%3C").replace(/>/g, "%3E");
}

function parseImageDataUrl(
  value: string,
  path: string,
): { mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif" } {
  const match = value.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,/i);
  if (!match) throw new LegacyDocumentImportError(path, "지원하지 않는 이미지 data URL입니다.");
  const mimeType = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  return { mimeType: mimeType as "image/png" | "image/jpeg" | "image/webp" | "image/gif" };
}

class IdAllocator {
  private readonly used = new Set<string>();

  create(prefix: string, source: string): string {
    const base = `legacy-${slug(prefix)}-${slug(source)}`;
    let id = base;
    let suffix = 2;
    while (this.used.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    this.used.add(id);
    return id;
  }
}

function slug(value: string): string {
  const normalized = value.trim().replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");
  return normalized || "item";
}
