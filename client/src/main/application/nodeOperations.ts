import { createEntityId, type DocumentData, type DocumentNode } from "../../foundation/documentModel.ts";
import { addNode, moveNode, duplicateNodeSubtree, setNodeVisibility, archiveNode, restoreNode, findNodeParentId } from "../../foundation/documentTransactions.ts";
import { requireDocumentNode, documentTree } from "../../foundation/documentCommandTargets.ts";
import { failure, type Operation, type OperationResult } from "../../foundation/documentCommands.ts";

export type OperationStep = { document: DocumentData; nodeIds: string[]; created?: OperationResult["created"]; idMap?: Record<string, string>; removedItemIds?: string[] };
export const NODE_OPERATIONS = ["add_node", "move_node", "duplicate_node", "set_visibility", "archive_node", "restore_node"] as const;
export function requireContainer(document: DocumentData, id: string) {
  const node = requireDocumentNode(document, id);
  if (node.type !== "container") failure("INVALID_TARGET", "활성 문서 container가 아닙니다.");
  return node;
}
export function validateIndex(index: number | undefined, length: number): void {
  if (index !== undefined && (!Number.isSafeInteger(index) || index < 0 || index > length)) failure("VALIDATION_FAILED", "삽입 위치가 허용 범위를 벗어났습니다.");
}
export function applyNodeOperation(document: DocumentData, operation: Operation): OperationStep | undefined {
  const options = { now: () => document.updatedAt };
  if (operation.type === "add_node") {
    const parent = requireContainer(document, operation.parentId); validateIndex(operation.index, parent.childIds.length);
    if (operation.node.type === "image" && !Object.hasOwn(document.assets, operation.node.assetId)) failure("INVALID_TARGET", "같은 문서의 이미지 asset이 필요합니다.");
    if (operation.node.type === "repeater" && !Object.hasOwn(document.components, operation.node.itemComponentId)) failure("INVALID_TARGET", "같은 문서의 컴포넌트 정의가 필요합니다.");
    const id = createEntityId("node");
    const node: DocumentNode = { ...operation.node, id, visible: true,
      ...(operation.node.type === "container" ? { childIds: [] } : {}), ...(operation.node.type === "repeater" ? { items: [] } : {}),
    } as DocumentNode;
    return { document: addNode(document, parent.id, node, operation.index, options), nodeIds: [parent.id, id], created: { nodeId: id } };
  }
  if (operation.type === "move_node" || operation.type === "duplicate_node") {
    const node = requireDocumentNode(document, operation.nodeId);
    if (node.id === document.rootNodeId) failure("INVALID_TARGET", "문서 root는 이동하거나 복제할 수 없습니다.");
    const parent = requireContainer(document, operation.parentId);
    const oldParent = findNodeParentId(document, node.id);
    validateIndex(operation.index, parent.childIds.length - (operation.type === "move_node" && oldParent === parent.id ? 1 : 0));
    if (operation.type === "move_node") {
      const descendants = new Set<string>();
      const visit = (id: string) => { if (descendants.has(id)) return; descendants.add(id); const child = document.nodes[id]; if (child.type === "container") child.childIds.forEach(visit); };
      visit(node.id);
      if (descendants.has(parent.id)) failure("VALIDATION_FAILED", "요소를 자기 자신이나 자손 아래로 이동할 수 없습니다.");
      return { document: moveNode(document, node.id, parent.id, operation.index, options), nodeIds: [node.id, parent.id, ...(oldParent ? [oldParent] : [])] };
    }
    const copy = duplicateNodeSubtree(document, node.id, parent.id, operation.index, options);
    return { document: copy.document, nodeIds: [parent.id, ...copy.idMap.values()], created: { nodeId: copy.rootNodeId }, idMap: Object.fromEntries(copy.idMap) };
  }
  if (operation.type === "set_visibility") {
    const node = requireDocumentNode(document, operation.nodeId);
    if (node.id === document.rootNodeId) failure("INVALID_TARGET", "문서 root의 표시 상태는 변경할 수 없습니다.");
    return { document: setNodeVisibility(document, node.id, operation.visible, options), nodeIds: [node.id] };
  }
  if (operation.type === "archive_node") {
    const node = requireDocumentNode(document, operation.nodeId, true);
    if (node.id === document.rootNodeId) failure("INVALID_TARGET", "문서 root는 보관할 수 없습니다.");
    if (!documentTree(document).has(node.id)) return { document, nodeIds: [] };
    const parentId = findNodeParentId(document, node.id);
    return { document: archiveNode(document, node.id, options), nodeIds: [node.id, ...(parentId ? [parentId] : [])] };
  }
  if (operation.type === "restore_node") {
    const node = requireDocumentNode(document, operation.nodeId, true);
    if (!node.archivedFrom) {
      if (!documentTree(document).has(node.id)) failure("INVALID_TARGET", "먼저 보관 subtree의 상위 요소를 복원하세요.");
      return { document, nodeIds: [] };
    }
    const parent = requireContainer(document, node.archivedFrom.parentId);
    return { document: restoreNode(document, node.id, options), nodeIds: [node.id, parent.id] };
  }
}
