import type {
  ComponentPropValue,
  DocumentAsset,
  DocumentData,
  DocumentNode,
  RichTextValue,
  StyleDefinition,
} from "../../../../../foundation/documentModel.ts";
import type { DocumentEditTarget } from "../../../../../foundation/documentEditing.ts";
import { assertDocumentData } from "../../../../../foundation/documentValidation.ts";

type RenderNodeBase = {
  renderId: string;
  sourceNodeId: string;
  name: string;
  visible: boolean;
  style?: StyleDefinition;
  editTarget?: DocumentEditTarget;
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
  fragment?: {
    blockIndexes: number[];
    first: boolean;
    last: boolean;
  };
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
  return resolveNode(document, document.rootNodeId, `node:${document.rootNodeId}`, new Map(), true);
}

type RenderOverride = {
  value: ComponentPropValue;
  target?: DocumentEditTarget;
};

function resolveNode(
  document: DocumentData,
  nodeId: string,
  renderId: string,
  overrides: Map<string, RenderOverride>,
  allowDirectEdits: boolean,
): RenderTreeNode {
  const source = document.nodes[nodeId];
  if (!source) throw new Error(`node를 찾을 수 없습니다: ${nodeId}`);
  const override = overrides.get(nodeId);
  const node = applyOverride(source, override?.value);
  const base = {
    renderId,
    sourceNodeId: node.id,
    name: node.name,
    visible: node.visible,
    style: node.styleId ? document.styles[node.styleId] : undefined,
    editTarget: override?.target ?? (allowDirectEdits && isDirectlyEditable(node)
      ? { kind: "node" as const, nodeId: node.id }
      : undefined),
  };

  if (node.type === "container") {
    return {
      ...base,
      type: node.type,
      children: node.childIds.map((childId) =>
        resolveNode(document, childId, `${renderId}/node:${childId}`, overrides, allowDirectEdits),
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
    const componentOverrides = buildOverrides(
      component.propDefinitions,
      node.props,
      allowDirectEdits
        ? (propId): DocumentEditTarget => ({ kind: "component-prop", instanceNodeId: node.id, propId })
        : undefined,
    );
    return {
      ...base,
      type: node.type,
      componentId: component.id,
      child: resolveNode(
        document,
        component.rootNodeId,
        `${renderId}/component:${component.id}/node:${component.rootNodeId}`,
        componentOverrides,
        false,
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
        buildOverrides(
          component.propDefinitions,
          item.props,
          allowDirectEdits
            ? (propId): DocumentEditTarget => ({
              kind: "repeater-item-prop",
              repeaterNodeId: node.id,
              itemId: item.id,
              propId,
            })
            : undefined,
        ),
        false,
      ),
    })),
  };
}

function buildOverrides(
  definitions: DocumentData["components"][string]["propDefinitions"],
  props: Record<string, ComponentPropValue>,
  target?: (propId: string) => DocumentEditTarget,
): Map<string, RenderOverride> {
  const overrides = new Map<string, RenderOverride>();
  definitions.forEach((definition) => {
    if (definition.status !== "active") return;
    overrides.set(definition.binding.nodeId, {
      value: Object.hasOwn(props, definition.id) ? props[definition.id] : definition.defaultValue,
      target: target?.(definition.id),
    });
  });
  return overrides;
}

function isDirectlyEditable(node: DocumentNode): boolean {
  return node.type === "text" || node.type === "rich-text" || node.type === "markdown";
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
