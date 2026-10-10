import type { DocumentData, DocumentNode } from "../../../foundation/documentModel.ts";
import { validateDocumentData } from "../../../foundation/documentValidation.ts";

const baselineStyleIds = [
  "legacy-style-root",
  "legacy-style-section",
  "legacy-style-item",
  "legacy-style-heading",
] as const;

export function upgradeLegacyImportedDocument(
  current: DocumentData,
  freshImport: DocumentData,
): DocumentData {
  if (current.documentId !== freshImport.documentId || !hasBaselineVisualStyles(current)) return current;

  const original = current;
  const next = structuredClone(current);
  next.styles = structuredClone(freshImport.styles);

  Object.entries(freshImport.nodes).forEach(([nodeId, freshNode]) => {
    const node = next.nodes[nodeId];
    if (!node || node.type !== freshNode.type) return;
    if (freshNode.styleId) node.styleId = freshNode.styleId;
    else delete node.styleId;
  });

  Object.entries(freshImport.nodes).forEach(([nodeId, freshNode]) => {
    const originalNode = original.nodes[nodeId];
    const nextNode = next.nodes[nodeId];
    if (freshNode.type !== "container" || originalNode?.type !== "container" || nextNode?.type !== "container") return;
    const flattened = flattenToExistingChildren(freshImport, freshNode.childIds, original.nodes);
    const matchesFreshVisualOrder = sameIds(originalNode.childIds, flattened);
    const matchesOriginalComponentOrder = hasOriginalComponentFieldOrder(
      freshImport,
      nodeId,
      originalNode.childIds,
    );
    if (!matchesFreshVisualOrder && !matchesOriginalComponentOrder) return;
    freshNode.childIds.forEach((childId) => addMissingSubtree(next, freshImport, childId));
    nextNode.childIds = [...freshNode.childIds];
  });

  const validation = validateDocumentData(next);
  return validation.valid ? next : current;
}

function hasOriginalComponentFieldOrder(
  fresh: DocumentData,
  rootNodeId: string,
  childIds: string[],
): boolean {
  const component = Object.values(fresh.components).find((entry) => entry.rootNodeId === rootNodeId);
  if (!component) return false;
  const fieldNodeIds = component.propDefinitions.map((prop) => prop.binding.nodeId);
  return sameIds(childIds, fieldNodeIds);
}

function hasBaselineVisualStyles(document: DocumentData): boolean {
  const keys = Object.keys(document.styles).sort();
  if (!sameIds(keys, [...baselineStyleIds].sort())) return false;
  const root = document.styles["legacy-style-root"];
  const section = document.styles["legacy-style-section"];
  const item = document.styles["legacy-style-item"];
  const heading = document.styles["legacy-style-heading"];
  const compact = root?.typography?.fontSizePt === 7.5;
  return root?.layout?.direction === "column" &&
    root.layout.gapPt === (compact ? 10 : 14) &&
    sameNumbers(root.layout.paddingPt, compact ? [24, 28, 24, 28] : [28, 32, 28, 32]) &&
    section?.layout?.direction === "column" &&
    section.layout.gapPt === (compact ? 5.5 : 8) &&
    item?.layout?.direction === "column" &&
    item.layout.gapPt === (compact ? 3 : 4) &&
    heading?.typography?.fontSizePt === (compact ? 11.25 : 12);
}

function flattenToExistingChildren(
  fresh: DocumentData,
  childIds: string[],
  existingNodes: Record<string, DocumentNode>,
): string[] {
  return childIds.flatMap((childId) => {
    if (existingNodes[childId]) return [childId];
    const child = fresh.nodes[childId];
    return child?.type === "container"
      ? flattenToExistingChildren(fresh, child.childIds, existingNodes)
      : [];
  });
}

function addMissingSubtree(target: DocumentData, fresh: DocumentData, nodeId: string): void {
  if (target.nodes[nodeId]) return;
  const node = fresh.nodes[nodeId];
  if (!node) return;
  target.nodes[nodeId] = structuredClone(node);
  if (node.type === "container") node.childIds.forEach((childId) => addMissingSubtree(target, fresh, childId));
}

function sameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameNumbers(left: number[] | undefined, right: number[]): boolean {
  return Boolean(left && left.length === right.length && left.every((value, index) => value === right[index]));
}
