import type {
  DocumentData,
  DocumentNode,
  StyleDefinition,
} from "./documentModel.ts";

export type DocumentUpdateOperation =
  | { type: "node-content-updated"; nodeId: string }
  | { type: "node-style-updated"; nodeId: string; styleKeys: readonly string[] }
  | { type: "node-inserted"; nodeId: string; parentId: string }
  | { type: "node-removed"; nodeId: string; parentId: string }
  | {
      type: "node-moved";
      nodeId: string;
      previousParentId: string;
      nextParentId: string;
    }
  | { type: "node-visibility-updated"; nodeId: string }
  | { type: "component-definition-updated"; componentId: string }
  | { type: "page-settings-updated"; keys: readonly string[] }
  | { type: "document-metadata-updated" }
  | { type: "document-replaced" };

export type DocumentUpdate = {
  revision: number;
  operations: readonly DocumentUpdateOperation[];
};

export function documentContentUpdate(
  revision: number,
  nodeId: string,
): DocumentUpdate {
  return {
    revision,
    operations: [{ type: "node-content-updated", nodeId }],
  };
}

export function fullDocumentUpdate(revision: number): DocumentUpdate {
  return {
    revision,
    operations: [{ type: "document-replaced" }],
  };
}

/**
 * Compatibility adapter for existing immutable transactions that return only
 * DocumentData. New transactions should report their operations directly.
 * This intentionally relies on structural sharing instead of deep-diffing the
 * full JSON graph.
 */
export function inferDocumentUpdateOperations(
  previous: DocumentData,
  next: DocumentData,
): DocumentUpdateOperation[] {
  if (
    previous.documentId !== next.documentId ||
    previous.schemaVersion !== next.schemaVersion ||
    previous.rootNodeId !== next.rootNodeId
  ) return [{ type: "document-replaced" }];

  const operations: DocumentUpdateOperation[] = [];
  const previousParents = parentIdsByChild(previous);
  const nextParents = parentIdsByChild(next);
  const allNodeIds = new Set([...Object.keys(previous.nodes), ...Object.keys(next.nodes)]);

  for (const nodeId of allNodeIds) {
    const previousNode = previous.nodes[nodeId];
    const nextNode = next.nodes[nodeId];
    const previousParentId = previousParents.get(nodeId);
    const nextParentId = nextParents.get(nodeId);

    if (!previousNode && nextNode) {
      if (nextParentId) operations.push({ type: "node-inserted", nodeId, parentId: nextParentId });
      continue;
    }
    if (previousNode && !nextNode) {
      if (previousParentId) operations.push({ type: "node-removed", nodeId, parentId: previousParentId });
      continue;
    }
    if (!previousNode || !nextNode) continue;

    if (previousParentId !== nextParentId) {
      if (previousParentId && nextParentId) {
        operations.push({
          type: "node-moved",
          nodeId,
          previousParentId,
          nextParentId,
        });
      } else if (previousParentId) {
        operations.push({ type: "node-removed", nodeId, parentId: previousParentId });
      } else if (nextParentId) {
        operations.push({ type: "node-inserted", nodeId, parentId: nextParentId });
      }
      continue;
    }
    if (previousNode === nextNode) continue;

    if (previousNode.type !== nextNode.type) {
      operations.push({ type: "node-content-updated", nodeId });
      continue;
    }
    if (previousNode.visible !== nextNode.visible) {
      operations.push({ type: "node-visibility-updated", nodeId });
    }
    if (previousNode.styleId !== nextNode.styleId) {
      operations.push({ type: "node-style-updated", nodeId, styleKeys: ["styleId"] });
    }
    if (nodeContentChanged(previousNode, nextNode)) {
      operations.push({ type: "node-content-updated", nodeId });
    }
  }

  collectReorderedNodes(previous, next, previousParents, nextParents, operations);
  collectChangedStyles(previous, next, operations);
  collectChangedComponents(previous, next, operations);
  collectChangedAssets(previous, next, operations);

  if (operations.length === 0 && previous.name !== next.name) {
    operations.push({ type: "document-metadata-updated" });
  }
  return deduplicateOperations(operations);
}

function parentIdsByChild(document: DocumentData): Map<string, string> {
  const parents = new Map<string, string>();
  Object.values(document.nodes).forEach((node) => {
    if (node.type !== "container") return;
    node.childIds.forEach((childId) => parents.set(childId, node.id));
  });
  return parents;
}

function nodeContentChanged(previous: DocumentNode, next: DocumentNode): boolean {
  if (previous.type !== next.type) return true;
  switch (previous.type) {
    case "container":
      return false;
    case "text":
      return next.type !== "text" || previous.value !== next.value;
    case "rich-text":
      return next.type !== "rich-text" || previous.value !== next.value;
    case "markdown":
      return next.type !== "markdown" || previous.source !== next.source;
    case "image":
      return next.type !== "image" || previous.assetId !== next.assetId || previous.alt !== next.alt;
    case "component-instance":
      return next.type !== "component-instance" ||
        previous.componentId !== next.componentId || previous.props !== next.props;
    case "repeater":
      return next.type !== "repeater" ||
        previous.itemComponentId !== next.itemComponentId || previous.items !== next.items;
  }
}

function collectReorderedNodes(
  previous: DocumentData,
  next: DocumentData,
  previousParents: ReadonlyMap<string, string>,
  nextParents: ReadonlyMap<string, string>,
  operations: DocumentUpdateOperation[],
): void {
  for (const node of Object.values(next.nodes)) {
    if (node.type !== "container") continue;
    const previousNode = previous.nodes[node.id];
    if (!previousNode || previousNode.type !== "container" || previousNode.childIds === node.childIds) continue;
    node.childIds.forEach((childId, index) => {
      if (
        previousNode.childIds[index] !== childId &&
        previousParents.get(childId) === node.id &&
        nextParents.get(childId) === node.id
      ) {
        operations.push({
          type: "node-moved",
          nodeId: childId,
          previousParentId: node.id,
          nextParentId: node.id,
        });
      }
    });
  }
}

function collectChangedStyles(
  previous: DocumentData,
  next: DocumentData,
  operations: DocumentUpdateOperation[],
): void {
  const styleIds = new Set([...Object.keys(previous.styles), ...Object.keys(next.styles)]);
  for (const styleId of styleIds) {
    const previousStyle = previous.styles[styleId];
    const nextStyle = next.styles[styleId];
    if (previousStyle === nextStyle) continue;
    if (!previousStyle || !nextStyle) {
      operations.push({ type: "document-replaced" });
      return;
    }
    const styleKeys = changedStyleKeys(previousStyle, nextStyle);
    const nodeIds = new Set<string>();
    Object.values(previous.nodes).forEach((node) => {
      if (node.styleId === styleId) nodeIds.add(node.id);
    });
    Object.values(next.nodes).forEach((node) => {
      if (node.styleId === styleId) nodeIds.add(node.id);
    });
    nodeIds.forEach((nodeId) => operations.push({ type: "node-style-updated", nodeId, styleKeys }));
  }
}

function changedStyleKeys(previous: StyleDefinition, next: StyleDefinition): string[] {
  const keys: string[] = [];
  collectChangedRecordKeys("layout", previous.layout, next.layout, keys);
  collectChangedRecordKeys("typography", previous.typography, next.typography, keys);
  collectChangedRecordKeys("markdown", previous.markdown, next.markdown, keys);
  collectChangedRecordKeys("decoration", previous.decoration, next.decoration, keys);
  collectChangedRecordKeys("pagination", previous.pagination, next.pagination, keys);
  return keys.length ? keys : ["style"];
}

function collectChangedRecordKeys(
  prefix: string,
  previous: object | undefined,
  next: object | undefined,
  keys: string[],
): void {
  if (previous === next) return;
  const previousRecord = (previous ?? {}) as Record<string, unknown>;
  const nextRecord = (next ?? {}) as Record<string, unknown>;
  const propertyNames = new Set([...Object.keys(previousRecord), ...Object.keys(nextRecord)]);
  propertyNames.forEach((propertyName) => {
    if (!Object.is(previousRecord[propertyName], nextRecord[propertyName])) {
      keys.push(`${prefix}.${propertyName}`);
    }
  });
}

function collectChangedComponents(
  previous: DocumentData,
  next: DocumentData,
  operations: DocumentUpdateOperation[],
): void {
  const componentIds = new Set([...Object.keys(previous.components), ...Object.keys(next.components)]);
  componentIds.forEach((componentId) => {
    if (previous.components[componentId] !== next.components[componentId]) {
      operations.push({ type: "component-definition-updated", componentId });
    }
  });
}

function collectChangedAssets(
  previous: DocumentData,
  next: DocumentData,
  operations: DocumentUpdateOperation[],
): void {
  const changedAssetIds = new Set<string>();
  const assetIds = new Set([...Object.keys(previous.assets), ...Object.keys(next.assets)]);
  assetIds.forEach((assetId) => {
    if (previous.assets[assetId] !== next.assets[assetId]) changedAssetIds.add(assetId);
  });
  if (!changedAssetIds.size) return;
  Object.values(next.nodes).forEach((node) => {
    if (node.type === "image" && node.assetId && changedAssetIds.has(node.assetId)) {
      operations.push({ type: "node-content-updated", nodeId: node.id });
    }
  });
}

function deduplicateOperations(
  operations: readonly DocumentUpdateOperation[],
): DocumentUpdateOperation[] {
  const seen = new Set<string>();
  return operations.filter((operation) => {
    const key = JSON.stringify(operation);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
