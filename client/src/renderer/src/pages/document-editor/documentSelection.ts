import type { DocumentData, DocumentNode } from "../../../../foundation/documentModel.ts";
import { collectDocumentTreeNodeIds } from "../../../../foundation/documentTransactions.ts";

export type DocumentSelection = {
  kind: "node";
  nodeId: string;
};

export function selectNode(nodeId: string): DocumentSelection {
  return { kind: "node", nodeId };
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
  return selection;
}

export function documentSelectableNodeIds(document: DocumentData): Set<string> {
  return collectDocumentTreeNodeIds(document);
}
