import type { DocumentData, DocumentNode } from "../../../../foundation/documentModel.ts";
import {
  collectDocumentTreeNodeIds,
  findNodeParentId,
} from "../../../../foundation/documentTransactions.ts";

export type DocumentSelection =
  | { kind: "node"; nodeId: string }
  | { kind: "repeater-item"; nodeId: string; itemId: string }
  | { kind: "component-node"; nodeId: string; componentNodeId: string; itemId?: string };

export type DocumentLayerFocusRequest = {
  nodeId: string;
  itemId?: string;
  componentNodeId?: string;
  requestId: number;
  moveFocus?: boolean;
};

export type RenderSelectionContext = {
  nodeId: string;
  repeaterItemId?: string;
  componentNodeId?: string;
};

export function selectNode(nodeId: string): DocumentSelection {
  return { kind: "node", nodeId };
}

export function selectRepeaterItem(nodeId: string, itemId: string): DocumentSelection {
  return { kind: "repeater-item", nodeId, itemId };
}

export function selectComponentNode(
  nodeId: string,
  componentNodeId: string,
  itemId?: string,
): DocumentSelection {
  return {
    kind: "component-node",
    nodeId,
    componentNodeId,
    ...(itemId ? { itemId } : {}),
  };
}

export function contentSelectionFromRenderTarget(
  target: RenderSelectionContext,
): DocumentSelection {
  return target.repeaterItemId
    ? selectRepeaterItem(target.nodeId, target.repeaterItemId)
    : selectNode(target.nodeId);
}

export function structureSelectionFromRenderTarget(
  target: RenderSelectionContext,
): DocumentSelection {
  if (target.componentNodeId) {
    return selectComponentNode(target.nodeId, target.componentNodeId, target.repeaterItemId);
  }
  return contentSelectionFromRenderTarget(target);
}

export function selectedNode(
  document: DocumentData,
  selection?: DocumentSelection,
): DocumentNode | undefined {
  if (!selection) return undefined;
  return document.nodes[selection.nodeId];
}

export function reconcileDocumentSelection(
  document: DocumentData,
  selection?: DocumentSelection,
): DocumentSelection | undefined {
  if (!selection) return undefined;
  const node = document.nodes[selection.nodeId];
  if (!node || node.archivedFrom) return undefined;
  if (!collectDocumentTreeNodeIds(document).has(node.id)) return undefined;
  if (selection.kind === "repeater-item") {
    if (node.type !== "repeater") return undefined;
    if (!node.items.some((item) => item.id === selection.itemId)) return undefined;
  }
  if (selection.kind === "component-node") {
    const componentId = node.type === "component-instance"
      ? node.componentId
      : node.type === "repeater"
        ? node.itemComponentId
        : undefined;
    if (!componentId) return undefined;
    if (node.type === "repeater") {
      if (!selection.itemId || !node.items.some((item) => item.id === selection.itemId)) return undefined;
    } else if (selection.itemId) return undefined;
    if (!componentNodeIds(document, componentId).has(selection.componentNodeId)) return undefined;
  }
  return selection;
}

function componentNodeIds(document: DocumentData, componentId: string): Set<string> {
  const result = new Set<string>();
  const visitedComponents = new Set<string>();
  const visitComponent = (id: string) => {
    if (visitedComponents.has(id)) return;
    visitedComponents.add(id);
    const component = document.components[id];
    if (component) visitNode(component.rootNodeId);
  };
  const visitNode = (nodeId: string) => {
    if (result.has(nodeId)) return;
    const node = document.nodes[nodeId];
    if (!node) return;
    result.add(nodeId);
    if (node.type === "container") node.childIds.forEach(visitNode);
    if (node.type === "component-instance") visitComponent(node.componentId);
    if (node.type === "repeater") visitComponent(node.itemComponentId);
  };
  visitComponent(componentId);
  return result;
}

export function documentSelectableNodeIds(document: DocumentData): Set<string> {
  return collectDocumentTreeNodeIds(document);
}

export function documentInsertionParentId(
  document: DocumentData,
  selectedId?: string,
  rootNodeId = document.rootNodeId,
): string {
  if (!selectedId || !collectStructuralNodeIds(document, rootNodeId).has(selectedId)) return rootNodeId;
  const selected = document.nodes[selectedId];
  if (selected?.type === "container" && !selected.archivedFrom) return selected.id;
  return findNodeParentId(document, selectedId) ?? rootNodeId;
}

function collectStructuralNodeIds(document: DocumentData, rootNodeId: string): Set<string> {
  if (rootNodeId === document.rootNodeId) return collectDocumentTreeNodeIds(document);
  const result = new Set<string>();
  const visit = (nodeId: string) => {
    if (result.has(nodeId)) return;
    const node = document.nodes[nodeId];
    if (!node || node.archivedFrom) return;
    result.add(nodeId);
    if (node.type === "container") node.childIds.forEach(visit);
  };
  visit(rootNodeId);
  return result;
}
