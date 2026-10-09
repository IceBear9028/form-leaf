import type {
  ComponentPropValue,
  DocumentAsset,
  DocumentData,
  DocumentNode,
  RichTextValue,
  StyleDefinition,
} from "../../../../../foundation/documentModel.ts";
import { assertDocumentData } from "../../../../../foundation/documentValidation.ts";

type RenderNodeBase = {
  renderId: string;
  sourceNodeId: string;
  name: string;
  visible: boolean;
  style?: StyleDefinition;
};

export type RenderContainerNode = RenderNodeBase & {
  type: "container";
  children: RenderTreeNode[];
};

export type RenderTextNode = RenderNodeBase & {
  type: "text";
  value: string;
};

export type RenderRichTextNode = RenderNodeBase & {
  type: "rich-text";
  value: RichTextValue;
};

export type RenderMarkdownNode = RenderNodeBase & {
  type: "markdown";
  source: string;
};

export type RenderImageNode = RenderNodeBase & {
  type: "image";
  asset?: DocumentAsset;
  alt: string;
};

export type RenderComponentNode = RenderNodeBase & {
  type: "component-instance";
  componentId: string;
  child: RenderTreeNode;
};

export type RenderRepeaterItem = {
  id: string;
  visible: boolean;
  child: RenderTreeNode;
};

export type RenderRepeaterNode = RenderNodeBase & {
  type: "repeater";
  componentId: string;
  items: RenderRepeaterItem[];
};

export type RenderTreeNode =
  | RenderContainerNode
  | RenderTextNode
  | RenderRichTextNode
  | RenderMarkdownNode
  | RenderImageNode
  | RenderComponentNode
  | RenderRepeaterNode;

export function buildRenderTree(document: DocumentData): RenderTreeNode {
  assertDocumentData(document);
  return resolveNode(document, document.rootNodeId, `node:${document.rootNodeId}`, new Map());
}

function resolveNode(
  document: DocumentData,
  nodeId: string,
  renderId: string,
  overrides: Map<string, ComponentPropValue>,
): RenderTreeNode {
  const source = document.nodes[nodeId];
  if (!source) throw new Error(`node를 찾을 수 없습니다: ${nodeId}`);
  const node = applyOverride(source, overrides.get(nodeId));
  const base = {
    renderId,
    sourceNodeId: node.id,
    name: node.name,
    visible: node.visible,
    style: node.styleId ? document.styles[node.styleId] : undefined,
  };

  if (node.type === "container") {
    return {
      ...base,
      type: node.type,
      children: node.childIds.map((childId) =>
        resolveNode(document, childId, `${renderId}/node:${childId}`, overrides),
      ),
    };
  }
  if (node.type === "text") return { ...base, type: node.type, value: node.value };
  if (node.type === "rich-text") return { ...base, type: node.type, value: structuredClone(node.value) };
  if (node.type === "markdown") return { ...base, type: node.type, source: node.source };
  if (node.type === "image") {
    return {
      ...base,
      type: node.type,
      asset: node.assetId ? document.assets[node.assetId] : undefined,
      alt: node.alt,
    };
  }
  if (node.type === "component-instance") {
    const component = document.components[node.componentId];
    const componentOverrides = buildOverrides(component.propDefinitions, node.props);
    return {
      ...base,
      type: node.type,
      componentId: component.id,
      child: resolveNode(
        document,
        component.rootNodeId,
        `${renderId}/component:${component.id}/node:${component.rootNodeId}`,
        componentOverrides,
      ),
    };
  }
  const component = document.components[node.itemComponentId];
  return {
    ...base,
    type: node.type,
    componentId: component.id,
    items: node.items.map((item) => ({
      id: item.id,
      visible: item.visible,
      child: resolveNode(
        document,
        component.rootNodeId,
        `${renderId}/item:${item.id}/component:${component.id}/node:${component.rootNodeId}`,
        buildOverrides(component.propDefinitions, item.props),
      ),
    })),
  };
}

function buildOverrides(
  definitions: DocumentData["components"][string]["propDefinitions"],
  props: Record<string, ComponentPropValue>,
): Map<string, ComponentPropValue> {
  const overrides = new Map<string, ComponentPropValue>();
  definitions.forEach((definition) => {
    if (definition.status !== "active") return;
    overrides.set(
      definition.binding.nodeId,
      Object.hasOwn(props, definition.id) ? props[definition.id] : definition.defaultValue,
    );
  });
  return overrides;
}

function applyOverride(
  node: DocumentNode,
  value: ComponentPropValue | undefined,
): DocumentNode {
  if (value === undefined) return node;
  if (node.type === "text" && typeof value === "string") return { ...node, value };
  if (node.type === "markdown" && typeof value === "string") return { ...node, source: value };
  if (node.type === "rich-text" && isRichTextValue(value)) return { ...node, value };
  if (node.type === "image" && isImageValue(value)) return { ...node, ...value };
  throw new Error(`node와 component prop 값이 일치하지 않습니다: ${node.id}`);
}

function isRichTextValue(value: ComponentPropValue): value is RichTextValue {
  return typeof value === "object" && "runs" in value;
}

function isImageValue(
  value: ComponentPropValue,
): value is Extract<ComponentPropValue, { alt: string }> {
  return typeof value === "object" && "alt" in value;
}
