import type { DocumentData, DocumentNode } from "../../../foundation/documentModel.ts";
import { validateDocumentData } from "../../../foundation/documentValidation.ts";
import { isDeepStrictEqual } from "node:util";

const baselineStyleIds = [
  "legacy-style-root",
  "legacy-style-section",
  "legacy-style-item",
  "legacy-style-heading",
] as const;

const generatedVisualV1StyleIds = [
  "legacy-style-root",
  "legacy-style-section",
  "legacy-style-section-boundary",
  "legacy-style-item",
  "legacy-style-heading",
  "legacy-style-heading-row",
  "legacy-style-annotation",
  "legacy-style-lead",
  "legacy-style-list",
  "legacy-style-meta",
  "legacy-style-content",
  "legacy-style-title",
  "legacy-style-accent-title",
  "legacy-style-compact-text",
  "legacy-style-header-row",
  "legacy-style-media",
  "legacy-style-identity",
  "legacy-style-role",
  "legacy-style-name",
  "legacy-style-aside",
  "legacy-style-contact-row",
  "legacy-style-contact-label",
  "legacy-style-contact-value",
] as const;

export function upgradeLegacyImportedDocument(
  current: DocumentData,
  freshImport: DocumentData,
): DocumentData {
  if (
    current.documentId !== freshImport.documentId ||
    (!hasBaselineVisualStyles(current) && !hasGeneratedVisualV1Styles(current, freshImport))
  ) return current;

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

  Object.entries(freshImport.nodes).forEach(([nodeId, freshNode]) => {
    const originalNode = original.nodes[nodeId];
    if (
      originalNode?.type !== "markdown" ||
      freshNode.type !== "rich-text" ||
      freshNode.styleId !== "legacy-style-contact-value"
    ) return;
    const links = standaloneMarkdownLinks(originalNode.source);
    if (!links?.length) return;
    next.nodes[nodeId] = {
      ...structuredClone(freshNode),
      name: originalNode.name,
      visible: originalNode.visible,
      value: {
        runs: links.flatMap((link, index) => [
          ...(index ? [{ text: " · " }] : []),
          {
            text: link.label,
            marks: [
              { type: "underline" as const },
              { type: "link" as const, href: link.href },
            ],
          },
        ]),
      },
    };
  });

  const validation = validateDocumentData(next);
  return validation.valid ? next : current;
}

function standaloneMarkdownLinks(source: string): Array<{ label: string; href: string }> | undefined {
  const pattern = /\[([^\]]+)\]\((?:<([^>]+)>|([^)]+))\)/g;
  const matches = [...source.matchAll(pattern)];
  const remainder = source.replace(pattern, "").replace(/[\s*·-]/g, "");
  if (remainder || !matches.length) return undefined;
  return matches.map((match) => ({
    label: (match[1] ?? "").replace(/^\+\+|\+\+$/g, "").replaceAll("\\", ""),
    href: match[2] ?? match[3] ?? "",
  }));
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

function hasGeneratedVisualV1Styles(current: DocumentData, freshImport: DocumentData): boolean {
  const currentIds = Object.keys(current.styles).sort();
  const expectedIds = [...generatedVisualV1StyleIds].sort();
  if (!sameIds(currentIds, expectedIds)) return false;

  const expected = Object.fromEntries(generatedVisualV1StyleIds.map((styleId) => {
    const style = freshImport.styles[styleId];
    return [styleId, style ? structuredClone(style) : undefined];
  }));
  if (Object.values(expected).some((style) => style === undefined)) return false;

  const root = expected["legacy-style-root"]!;
  const compact = root.typography?.fontSizePt === 7.5;
  if (root.layout) root.layout.gapPt = compact ? 10 : 13;

  const section = expected["legacy-style-section"]!;
  if (section.layout) section.layout.gapPt = compact ? 9 : 12;
  delete section.pagination;

  const headingRow = expected["legacy-style-heading-row"]!;
  headingRow.pagination = { keepWithNext: true };

  const lead = expected["legacy-style-lead"]!;
  delete lead.layout;

  const headerRow = expected["legacy-style-header-row"]!;
  if (headerRow.layout?.paddingPt) headerRow.layout.paddingPt[2] = compact ? 13 : 16;

  const aside = expected["legacy-style-aside"]!;
  if (aside.layout) aside.layout.gapPt = 8;

  return isDeepStrictEqual(current.styles, expected);
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
