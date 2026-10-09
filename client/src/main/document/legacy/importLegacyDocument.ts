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
  private readonly itemStyleId = this.ids.create("style", "item");
  private readonly headingStyleId = this.ids.create("style", "heading");
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
    return {
      [this.rootStyleId]: {
        id: this.rootStyleId,
        name: "Document",
        layout: {
          direction: "column",
          gapPt: compact ? 10 : 14,
          paddingPt: compact ? [24, 28, 24, 28] : [28, 32, 28, 32],
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
        layout: { direction: "column", gapPt: compact ? 5.5 : 8, align: "stretch", width: { mode: "fill" } },
      },
      [this.itemStyleId]: {
        id: this.itemStyleId,
        name: "Item",
        layout: { direction: "column", gapPt: compact ? 3 : 4, align: "stretch", width: { mode: "fill" } },
        pagination: { keepTogether: true },
      },
      [this.headingStyleId]: {
        id: this.headingStyleId,
        name: "Heading",
        typography: {
          fontSizePt: compact ? 11.25 : 12,
          lineHeight: 1.25,
          fontWeight: 600,
          color: { kind: "hex", value: "#000000" },
        },
        pagination: { keepWithNext: true },
      },
    };
  }

  private addProfile(section: LegacyProfileSection, sectionIndex: number): void {
    const containerId = this.addSectionContainer(section.id, sectionIndex, "Profile", section.visible);
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
        assetId,
        alt: section.name,
      });
    }
    this.addTextChild(containerId, `${section.id}-role`, "Role", section.role);
    this.addTextChild(containerId, `${section.id}-name`, "Name", section.name);
    this.addTextChild(containerId, `${section.id}-phone`, "Phone", section.phone);
    this.addTextChild(containerId, `${section.id}-email`, "Email", section.email);
    this.addMarkdownChild(containerId, `${section.id}-links`, "Links", linksToMarkdown(section.links));
  }

  private addMarkdownSection(
    section: Extract<LegacySection, { type: "introduction" | "free-text" }>,
    sectionIndex: number,
  ): void {
    const containerId = this.addSectionContainer(section.id, sectionIndex, section.title, section.visible);
    this.addHeading(containerId, `${section.id}-heading`, section.title);
    this.addMarkdownChild(containerId, `${section.id}-body`, "Body", section.bodyMarkdown);
  }

  private addTimeline(section: LegacyTimelineSection, sectionIndex: number): void {
    const containerId = this.addSectionContainer(section.id, sectionIndex, section.title, section.visible);
    this.addHeading(containerId, `${section.id}-heading`, section.title);
    if (section.annotation !== undefined) {
      this.addTextChild(containerId, `${section.id}-annotation`, "Annotation", section.annotation);
    }
    const component = this.createTimelineComponent(section);
    const repeaterId = this.ids.create("node", `${section.id}-items`);
    this.addChild(containerId, {
      id: repeaterId,
      type: "repeater",
      name: `${section.title} items`,
      visible: true,
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
    this.addHeading(containerId, `${section.id}-heading`, section.title);
    const component = this.createProjectComponent(section);
    this.addChild(containerId, {
      id: this.ids.create("node", `${section.id}-items`),
      type: "repeater",
      name: `${section.title} items`,
      visible: true,
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
    return this.createItemComponent(section.id, `${section.title} item`, [
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
    return this.createItemComponent(section.id, `${section.title} item`, [
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
    const propDefinitions: ComponentPropDefinition[] = fields.map((field) => {
      const nodeId = this.ids.create("node", `${sourceId}-${field.id}`);
      const node = field.createNode(nodeId);
      this.document.nodes[nodeId] = node;
      root.childIds.push(nodeId);
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
      styleId: this.sectionStyleId,
      childIds: [],
    });
    return id;
  }

  private addHeading(parentId: string, sourceId: string, value: string): void {
    const id = this.ids.create("node", sourceId);
    this.addChild(parentId, {
      id,
      type: "text",
      name: "Heading",
      visible: true,
      styleId: this.headingStyleId,
      value,
    });
  }

  private addTextChild(parentId: string, sourceId: string, name: string, value: string): void {
    const id = this.ids.create("node", sourceId);
    this.addChild(parentId, { id, type: "text", name, visible: true, value });
  }

  private addMarkdownChild(parentId: string, sourceId: string, name: string, source: string): void {
    const id = this.ids.create("node", sourceId);
    this.addChild(parentId, { id, type: "markdown", name, visible: true, source });
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
    links: linksToMarkdown(item.links),
    body: item.bodyMarkdown,
  };
}

function projectProps(item: LegacyProjectItem): Record<string, ComponentPropValue> {
  return {
    ...timelineProps(item),
    tags: listToMarkdown(item.techStack),
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

function linksToMarkdown(links: LegacyLink[]): string {
  return links.map((link) => `- [${escapeMarkdownText(link.label)}](<${escapeMarkdownUrl(link.href)}>)`).join("\n");
}

function listToMarkdown(items: string[]): string {
  return items.map((item) => `- ${escapeMarkdownText(item)}`).join("\n");
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
