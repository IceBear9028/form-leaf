import {
  createDocumentStyleFromPreset,
  DEFAULT_DOCUMENT_STYLE_PRESET_ID,
} from "./documentStylePresets.ts";

export const DOCUMENT_SCHEMA_VERSION = 4 as const;

export type NodeId = string;
export type ComponentId = string;
export type StyleId = string;
export type AssetId = string;

export type ArchivedPlacement = {
  parentId: NodeId;
  index: number;
};

export type NodeBase = {
  id: NodeId;
  name: string;
  visible: boolean;
  styleId?: StyleId;
  archivedFrom?: ArchivedPlacement;
};

export type ContainerNode = NodeBase & {
  type: "container";
  childIds: NodeId[];
};

export type TextNode = NodeBase & {
  type: "text";
  value: string;
};

export type RichTextMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "strike" }
  | { type: "link"; href: string }
  | { type: "color"; color: ColorValue };

export type RichTextRun = {
  text: string;
  marks?: RichTextMark[];
};

export type RichTextValue = {
  runs: RichTextRun[];
};

export type RichTextNode = NodeBase & {
  type: "rich-text";
  value: RichTextValue;
};

export type MarkdownNode = NodeBase & {
  type: "markdown";
  source: string;
};

export type ImageValue = {
  assetId?: AssetId;
  alt: string;
};

export type ImageNode = NodeBase & ImageValue & {
  type: "image";
};

export type ComponentPropValue = string | number | boolean | RichTextValue | ImageValue;

export type ComponentInstanceValue = {
  id: string;
  componentId: ComponentId;
  visible: boolean;
  props: Record<string, ComponentPropValue>;
};

export type RepeaterNode = NodeBase & {
  type: "repeater";
  itemComponentId: ComponentId;
  items: ComponentInstanceValue[];
};

export type ComponentInstanceNode = NodeBase & {
  type: "component-instance";
  componentId: ComponentId;
  props: Record<string, ComponentPropValue>;
};

export type DocumentNode =
  | ContainerNode
  | TextNode
  | RichTextNode
  | MarkdownNode
  | ImageNode
  | RepeaterNode
  | ComponentInstanceNode;

export type ComponentPropValueType =
  | "text"
  | "rich-text"
  | "markdown"
  | "number"
  | "boolean"
  | "image";

export type ComponentPropBinding =
  | { nodeId: NodeId; property: "text.value" }
  | { nodeId: NodeId; property: "rich-text.value" }
  | { nodeId: NodeId; property: "markdown.source" }
  | { nodeId: NodeId; property: "image.value" };

export type ComponentPropDefinition = {
  id: string;
  name: string;
  status: "active" | "archived";
  valueType: ComponentPropValueType;
  binding: ComponentPropBinding;
  defaultValue: ComponentPropValue;
};

export type ComponentDefinition = {
  id: ComponentId;
  name: string;
  rootNodeId: NodeId;
  propDefinitions: ComponentPropDefinition[];
};

export type ColorValue =
  | { kind: "token"; token: string }
  | { kind: "hex"; value: string };

export type WidthValue =
  | { mode: "auto" | "fill" }
  | { mode: "fixed"; valuePt: number };

export type StyleDefinition = {
  id: StyleId;
  name: string;
  layout?: {
    direction?: "row" | "column";
    gapPt?: number;
    paddingPt?: [number, number, number, number];
    align?: "start" | "center" | "end" | "stretch";
    justify?: "start" | "center" | "end" | "between";
    width?: WidthValue;
    heightPt?: number;
    grow?: number;
    position?: "relative" | "absolute";
    topPt?: number;
    rightPt?: number;
    bottomPt?: number;
    leftPt?: number;
  };
  typography?: {
    fontFamily?: string;
    fontSizePt?: number;
    lineHeight?: number;
    fontWeight?: number;
    color?: ColorValue;
  };
  markdown?: {
    listItemGapPt?: number;
  };
  decoration?: {
    background?: ColorValue;
    borderColor?: ColorValue;
    borderWidthPt?: number;
    borderEdges?: Array<"top" | "right" | "bottom" | "left">;
    radiusPt?: number;
  };
  pagination?: {
    keepTogether?: boolean;
    keepWithNext?: boolean;
    forcePageBreakBefore?: boolean;
  };
};

export type ImageAsset = {
  id: AssetId;
  type: "image";
  name: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  dataUrl: string;
};

export type DocumentAsset = ImageAsset;

export type DocumentData = {
  schemaVersion: typeof DOCUMENT_SCHEMA_VERSION;
  documentId: string;
  name: string;
  rootNodeId: NodeId;
  nodes: Record<NodeId, DocumentNode>;
  components: Record<ComponentId, ComponentDefinition>;
  styles: Record<StyleId, StyleDefinition>;
  assets: Record<AssetId, DocumentAsset>;
  updatedAt: string;
};

export type CreateEmptyDocumentOptions = {
  documentId?: string;
  name?: string;
  now?: string;
  createId?: (prefix: string) => string;
};

export function createEntityId(prefix = "item"): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createEmptyDocument(
  options: CreateEmptyDocumentOptions = {},
): DocumentData {
  const createId = options.createId ?? createEntityId;
  const rootNodeId = createId("node");
  const rootStyleId = createId("style");
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    documentId: options.documentId ?? createId("document"),
    name: options.name ?? "새 문서",
    rootNodeId,
    nodes: {
      [rootNodeId]: {
        id: rootNodeId,
        type: "container",
        name: "Root",
        visible: true,
        styleId: rootStyleId,
        childIds: [],
      },
    },
    components: {},
    styles: {
      [rootStyleId]: createDocumentStyleFromPreset(DEFAULT_DOCUMENT_STYLE_PRESET_ID, rootStyleId),
    },
    assets: {},
    updatedAt: options.now ?? new Date().toISOString(),
  };
}
