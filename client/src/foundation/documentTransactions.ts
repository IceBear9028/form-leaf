import type {
  ComponentDefinition,
  ComponentInstanceValue,
  DocumentData,
  DocumentNode,
  NodeId,
  StyleDefinition,
} from "./documentModel.ts";
import { createEntityId } from "./documentModel.ts";
import { assertDocumentData } from "./documentValidation.ts";

export type DocumentTransactionOptions = {
  now?: () => string;
  createId?: (prefix: string) => string;
};

export function addNode(
  document: DocumentData,
  parentId: NodeId,
  node: DocumentNode,
  index?: number,
  options?: DocumentTransactionOptions,
): DocumentData {
  assertDocumentData(document);
  if (document.nodes[node.id]) throw new Error(`이미 존재하는 node ID입니다: ${node.id}`);
  if (node.archivedFrom) throw new Error("새 node에는 archivedFrom을 지정할 수 없습니다.");
  const parent = requireContainer(document, parentId);
  const insertionIndex = clampIndex(index, parent.childIds.length);
  return commit({
    ...document,
    nodes: {
      ...document.nodes,
      [parentId]: {
        ...parent,
        childIds: insertAt(parent.childIds, node.id, insertionIndex),
      },
      [node.id]: clone(node),
    },
  }, options);
}

export function moveNode(
  document: DocumentData,
  nodeId: NodeId,
  targetParentId: NodeId,
  index?: number,
  options?: DocumentTransactionOptions,
): DocumentData {
  assertDocumentData(document);
  const node = requireNode(document, nodeId);
  if (node.archivedFrom) throw new Error("보관된 node는 복원한 뒤 이동해야 합니다.");
  const sourceParent = findParent(document, nodeId);
  if (!sourceParent) throw new Error("document 또는 component root는 이동할 수 없습니다.");
  const targetParent = requireContainer(document, targetParentId);
  const sourceChildren = sourceParent.childIds.filter((id) => id !== nodeId);
  const targetChildren = sourceParent.id === targetParent.id
    ? sourceChildren
    : targetParent.childIds;
  const insertionIndex = clampIndex(index, targetChildren.length);
  const nextNodes = {
    ...document.nodes,
    [sourceParent.id]: { ...sourceParent, childIds: sourceChildren },
    [targetParent.id]: {
      ...(sourceParent.id === targetParent.id
        ? { ...targetParent, childIds: sourceChildren }
        : targetParent),
      childIds: insertAt(targetChildren, nodeId, insertionIndex),
    },
  };
  return commit({ ...document, nodes: nextNodes }, options);
}

export function duplicateNodeSubtree(
  document: DocumentData,
  nodeId: NodeId,
  targetParentId: NodeId,
  index?: number,
  options?: DocumentTransactionOptions,
): { document: DocumentData; rootNodeId: NodeId; idMap: Map<NodeId, NodeId> } {
  assertDocumentData(document);
  requireNode(document, nodeId);
  const targetParent = requireContainer(document, targetParentId);
  const createId = options?.createId ?? createEntityId;
  const usedIds = new Set(Object.keys(document.nodes));
  const idMap = new Map<NodeId, NodeId>();
  const copies: Record<NodeId, DocumentNode> = {};

  const copyNode = (sourceId: NodeId): NodeId => {
    const existing = idMap.get(sourceId);
    if (existing) return existing;
    const source = requireNode(document, sourceId);
    const nextId = createUniqueId(source.type, usedIds, createId);
    idMap.set(sourceId, nextId);
    const copy = clone(source);
    copy.id = nextId;
    delete copy.archivedFrom;
    if (copy.type === "container" && source.type === "container") {
      copy.childIds = source.childIds.map(copyNode);
    }
    if (copy.type === "repeater") {
      copy.items = copy.items.map((item) => ({
        ...item,
        id: createUniqueId("item", usedIds, createId),
      }));
    }
    copies[nextId] = copy;
    return nextId;
  };

  const rootNodeId = copyNode(nodeId);
  const insertionIndex = clampIndex(index, targetParent.childIds.length);
  const nextDocument = commit({
    ...document,
    nodes: {
      ...document.nodes,
      ...copies,
      [targetParentId]: {
        ...targetParent,
        childIds: insertAt(targetParent.childIds, rootNodeId, insertionIndex),
      },
    },
  }, options);
  return { document: nextDocument, rootNodeId, idMap };
}

export function setNodeVisibility(
  document: DocumentData,
  nodeId: NodeId,
  visible: boolean,
  options?: DocumentTransactionOptions,
): DocumentData {
  assertDocumentData(document);
  const node = requireNode(document, nodeId);
  return commit({
    ...document,
    nodes: {
      ...document.nodes,
      [nodeId]: { ...node, visible },
    },
  }, options);
}

export function renameNode(
  document: DocumentData,
  nodeId: NodeId,
  name: string,
  options?: DocumentTransactionOptions,
): DocumentData {
  return updateNode(document, nodeId, (node) => ({ ...node, name }), options);
}

export function updateNode(
  document: DocumentData,
  nodeId: NodeId,
  update: (node: DocumentNode) => DocumentNode,
  options?: DocumentTransactionOptions,
): DocumentData {
  assertDocumentData(document);
  const current = requireNode(document, nodeId);
  const next = update(clone(current));
  if (next.id !== current.id) throw new Error("node ID는 변경할 수 없습니다.");
  if (next.type !== current.type) throw new Error("node type은 변경할 수 없습니다.");
  return commit({
    ...document,
    nodes: { ...document.nodes, [nodeId]: next },
  }, options);
}

export function updateNodeStyle(
  document: DocumentData,
  nodeId: NodeId,
  update: (style: StyleDefinition) => StyleDefinition,
  options?: DocumentTransactionOptions,
): DocumentData {
  assertDocumentData(document);
  const node = requireNode(document, nodeId);
  const createId = options?.createId ?? createEntityId;
  const styleId = node.styleId ?? createUniqueId(
    "style",
    new Set(Object.keys(document.styles)),
    createId,
  );
  const current: StyleDefinition = node.styleId
    ? clone(document.styles[node.styleId]!)
    : { id: styleId, name: node.name ? `${node.name} style` : "Style" };
  const nextStyle = update(current);
  if (nextStyle.id !== styleId) throw new Error("style ID는 변경할 수 없습니다.");
  return commit({
    ...document,
    nodes: {
      ...document.nodes,
      [nodeId]: { ...node, styleId },
    },
    styles: {
      ...document.styles,
      [styleId]: nextStyle,
    },
  }, options);
}

export function detachNodeStyle(
  document: DocumentData,
  nodeId: NodeId,
  options?: DocumentTransactionOptions,
): DocumentData {
  assertDocumentData(document);
  const node = requireNode(document, nodeId);
  if (!node.styleId) return document;
  const nextNode = clone(node);
  delete nextNode.styleId;
  const stillUsed = Object.values(document.nodes).some(
    (entry) => entry.id !== nodeId && entry.styleId === node.styleId,
  );
  const styles = { ...document.styles };
  if (!stillUsed) delete styles[node.styleId];
  return commit({
    ...document,
    nodes: { ...document.nodes, [nodeId]: nextNode },
    styles,
  }, options);
}

export function findNodeParentId(
  document: DocumentData,
  nodeId: NodeId,
): NodeId | undefined {
  return findParent(document, nodeId)?.id;
}

export function collectDocumentTreeNodeIds(document: DocumentData): Set<NodeId> {
  assertDocumentData(document);
  const result = new Set<NodeId>();
  const visit = (nodeId: NodeId) => {
    if (result.has(nodeId)) return;
    result.add(nodeId);
    const node = document.nodes[nodeId];
    if (node?.type === "container") node.childIds.forEach(visit);
  };
  visit(document.rootNodeId);
  return result;
}

export function archiveNode(
  document: DocumentData,
  nodeId: NodeId,
  options?: DocumentTransactionOptions,
): DocumentData {
  assertDocumentData(document);
  const node = requireNode(document, nodeId);
  if (node.archivedFrom) return document;
  const parent = findParent(document, nodeId);
  if (!parent) throw new Error("document 또는 component root는 보관할 수 없습니다.");
  const index = parent.childIds.indexOf(nodeId);
  return commit({
    ...document,
    nodes: {
      ...document.nodes,
      [parent.id]: {
        ...parent,
        childIds: parent.childIds.filter((id) => id !== nodeId),
      },
      [nodeId]: {
        ...node,
        archivedFrom: { parentId: parent.id, index },
      },
    },
  }, options);
}

export function restoreNode(
  document: DocumentData,
  nodeId: NodeId,
  options?: DocumentTransactionOptions,
): DocumentData {
  assertDocumentData(document);
  const node = requireNode(document, nodeId);
  if (!node.archivedFrom) return document;
  const parent = requireContainer(document, node.archivedFrom.parentId);
  const restoredNode = clone(node);
  delete restoredNode.archivedFrom;
  return commit({
    ...document,
    nodes: {
      ...document.nodes,
      [parent.id]: {
        ...parent,
        childIds: insertAt(
          parent.childIds,
          nodeId,
          clampIndex(node.archivedFrom.index, parent.childIds.length),
        ),
      },
      [nodeId]: restoredNode,
    },
  }, options);
}

export function addComponentDefinition(
  document: DocumentData,
  definition: ComponentDefinition,
  nodes: Record<NodeId, DocumentNode>,
  options?: DocumentTransactionOptions,
): DocumentData {
  assertDocumentData(document);
  if (document.components[definition.id]) {
    throw new Error(`이미 존재하는 component ID입니다: ${definition.id}`);
  }
  Object.keys(nodes).forEach((nodeId) => {
    if (document.nodes[nodeId]) throw new Error(`이미 존재하는 node ID입니다: ${nodeId}`);
  });
  if (!nodes[definition.rootNodeId]) throw new Error("추가할 node에 component root가 없습니다.");
  return commit({
    ...document,
    nodes: { ...document.nodes, ...clone(nodes) },
    components: {
      ...document.components,
      [definition.id]: clone(definition),
    },
  }, options);
}

export function addComponentInstance(
  document: DocumentData,
  parentId: NodeId,
  instance: Extract<DocumentNode, { type: "component-instance" }>,
  index?: number,
  options?: DocumentTransactionOptions,
): DocumentData {
  if (!document.components[instance.componentId]) {
    throw new Error(`참조한 component를 찾을 수 없습니다: ${instance.componentId}`);
  }
  return addNode(document, parentId, instance, index, options);
}

export function archiveComponentProp(
  document: DocumentData,
  componentId: string,
  propId: string,
  options?: DocumentTransactionOptions,
): DocumentData {
  assertDocumentData(document);
  const component = document.components[componentId];
  if (!component) throw new Error(`component를 찾을 수 없습니다: ${componentId}`);
  if (!component.propDefinitions.some((prop) => prop.id === propId)) {
    throw new Error(`prop을 찾을 수 없습니다: ${propId}`);
  }
  return commit({
    ...document,
    components: {
      ...document.components,
      [componentId]: {
        ...component,
        propDefinitions: component.propDefinitions.map((prop) =>
          prop.id === propId ? { ...prop, status: "archived" as const } : prop,
        ),
      },
    },
  }, options);
}

export function addRepeaterItem(
  document: DocumentData,
  repeaterNodeId: NodeId,
  item: ComponentInstanceValue,
  index?: number,
  options?: DocumentTransactionOptions,
): DocumentData {
  assertDocumentData(document);
  const node = requireNode(document, repeaterNodeId);
  if (node.type !== "repeater") throw new Error("대상 node가 repeater가 아닙니다.");
  if (item.componentId !== node.itemComponentId) {
    throw new Error("item component가 repeater 정의와 일치하지 않습니다.");
  }
  const insertionIndex = clampIndex(index, node.items.length);
  return commit({
    ...document,
    nodes: {
      ...document.nodes,
      [repeaterNodeId]: {
        ...node,
        items: insertAt(node.items, clone(item), insertionIndex),
      },
    },
  }, options);
}

function commit(
  document: DocumentData,
  options?: DocumentTransactionOptions,
): DocumentData {
  const next = {
    ...document,
    updatedAt: (options?.now ?? (() => new Date().toISOString()))(),
  };
  assertDocumentData(next);
  return next;
}

function requireNode(document: DocumentData, nodeId: NodeId): DocumentNode {
  const node = document.nodes[nodeId];
  if (!node) throw new Error(`node를 찾을 수 없습니다: ${nodeId}`);
  return node;
}

function requireContainer(
  document: DocumentData,
  nodeId: NodeId,
): Extract<DocumentNode, { type: "container" }> {
  const node = requireNode(document, nodeId);
  if (node.type !== "container") throw new Error(`container node가 아닙니다: ${nodeId}`);
  return node;
}

function findParent(
  document: DocumentData,
  nodeId: NodeId,
): Extract<DocumentNode, { type: "container" }> | undefined {
  return Object.values(document.nodes).find(
    (node): node is Extract<DocumentNode, { type: "container" }> =>
      node.type === "container" && node.childIds.includes(nodeId),
  );
}

function insertAt<T>(items: T[], item: T, index: number): T[] {
  const next = [...items];
  next.splice(index, 0, item);
  return next;
}

function clampIndex(index: number | undefined, length: number): number {
  if (index === undefined) return length;
  if (!Number.isInteger(index)) throw new Error("삽입 위치는 정수여야 합니다.");
  return Math.min(Math.max(index, 0), length);
}

function createUniqueId(
  prefix: string,
  usedIds: Set<string>,
  createId: (prefix: string) => string,
): string {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const id = createId(prefix);
    if (usedIds.has(id)) continue;
    usedIds.add(id);
    return id;
  }
  throw new Error("고유한 ID를 만들지 못했습니다.");
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
