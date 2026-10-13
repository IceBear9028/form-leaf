import { parseMarkdownBlocks } from "../markdown/parser.ts";
import type {
  RenderComponentNode,
  RenderContainerNode,
  RenderMarkdownNode,
  RenderRepeaterNode,
  RenderTreeNode,
} from "./renderTree.ts";

export type PaginationUnit = {
  id: string;
  node: RenderTreeNode;
  keepTogether: boolean;
  keepWithNext?: boolean;
  forcePageBreakBefore?: boolean;
};

export type PaginatedPage<T extends Pick<PaginationUnit, "id" | "keepWithNext" | "forcePageBreakBefore">> = {
  id: string;
  units: T[];
  overflow: boolean;
};

export function collectPaginationUnits(root: RenderTreeNode): PaginationUnit[] {
  const nodes = root.type === "container" ? root.children : [root];
  return nodes.flatMap(splitPaginationNode);
}

function splitPaginationNode(node: RenderTreeNode): PaginationUnit[] {
  if (!node.visible) return [];
  if (node.style?.pagination?.keepTogether) return [unitFromNode(node)];
  if (node.type === "markdown") return splitMarkdown(node);
  if (node.type === "component-instance") return splitComponent(node);
  if (node.type === "repeater") return splitRepeater(node);
  if (node.type !== "container") return [unitFromNode(node)];

  const childUnits = node.children.flatMap(splitPaginationNode);
  if (!childUnits.length) return [unitFromNode(node)];
  return childUnits.map((unit, index) => {
    const wrapper = wrapContainerUnit(node, unit, index);
    return {
      ...unit,
      id: wrapper.renderId,
      node: wrapper,
      forcePageBreakBefore: index === 0
        ? node.style?.pagination?.forcePageBreakBefore ?? unit.forcePageBreakBefore
        : unit.forcePageBreakBefore,
    };
  });
}

function splitMarkdown(node: RenderMarkdownNode): PaginationUnit[] {
  const blocks = parseMarkdownBlocks(node.source);
  const visibleBlockIndexes = blocks.flatMap((block, index) => (
    block.node.type === "definition" || block.node.type === "footnoteDefinition" ? [] : [index]
  ));
  if (visibleBlockIndexes.length <= 1) return [unitFromNode(node)];
  const firstHeadingPosition = visibleBlockIndexes.findIndex((blockIndex) => (
    blocks[blockIndex].node.type === "heading"
  ));
  return visibleBlockIndexes.map((blockIndex, fragmentIndex) => {
    const block = blocks[blockIndex];
    const nextBlockIndex = visibleBlockIndexes[fragmentIndex + 1];
    const nextBlock = nextBlockIndex === undefined ? undefined : blocks[nextBlockIndex];
    const leadBeforeFirstHeading = firstHeadingPosition > 0 && fragmentIndex < firstHeadingPosition;
    const quoteBeforeList = block.node.type === "blockquote" && nextBlock?.node.type === "list";
    const fragment: RenderMarkdownNode = {
      ...node,
      renderId: `${node.renderId}/markdown-block:${block.id}`,
      style: fragmentIndex === 0 ? node.style : continuationStyle(node.style),
      fragment: {
        blockIndexes: [blockIndex],
        first: fragmentIndex === 0,
        last: fragmentIndex === visibleBlockIndexes.length - 1,
      },
    };
    return {
      ...unitFromNode(fragment),
      keepWithNext: leadBeforeFirstHeading ||
        block.node.type === "heading" ||
        quoteBeforeList ||
        node.style?.pagination?.keepWithNext,
      forcePageBreakBefore: fragmentIndex === 0
        ? node.style?.pagination?.forcePageBreakBefore
        : undefined,
    };
  });
}

function splitComponent(node: RenderComponentNode): PaginationUnit[] {
  const childUnits = splitPaginationNode(node.child);
  if (childUnits.length <= 1) return [unitFromNode(node)];
  return childUnits.map((unit, index) => {
    const wrapper: RenderComponentNode = {
      ...node,
      renderId: `${node.renderId}/page-unit:${unit.id}`,
      style: index === 0 ? node.style : continuationStyle(node.style),
      child: unit.node,
    };
    return {
      ...unit,
      id: wrapper.renderId,
      node: wrapper,
      forcePageBreakBefore: index === 0
        ? node.style?.pagination?.forcePageBreakBefore ?? unit.forcePageBreakBefore
        : unit.forcePageBreakBefore,
    };
  });
}

function unitFromNode(node: RenderTreeNode): PaginationUnit {
  return {
    id: node.renderId,
    node,
    keepTogether: node.style?.pagination?.keepTogether ?? false,
    keepWithNext: node.style?.pagination?.keepWithNext,
    forcePageBreakBefore: node.style?.pagination?.forcePageBreakBefore,
  };
}

function splitRepeater(node: RenderRepeaterNode): PaginationUnit[] {
  const visibleItems = node.items.filter((item) => item.visible);
  if (!visibleItems.length) return [unitFromNode(node)];
  const result: PaginationUnit[] = [];
  visibleItems.forEach((item, itemIndex) => {
    const childUnits = item.child.style?.pagination?.keepTogether
      ? [unitFromNode(item.child)]
      : splitPaginationNode(item.child);
    childUnits.forEach((unit, unitIndex) => {
      const wrapper: RenderRepeaterNode = {
        ...node,
        renderId: `${node.renderId}/page-item:${item.id}/unit:${unit.id}`,
        style: result.length === 0 ? node.style : continuationStyle(node.style),
        items: [{ ...item, child: unit.node }],
      };
      result.push({
        ...unit,
        id: wrapper.renderId,
        node: wrapper,
        forcePageBreakBefore: itemIndex === 0 && unitIndex === 0
          ? node.style?.pagination?.forcePageBreakBefore ?? unit.forcePageBreakBefore
          : unit.forcePageBreakBefore,
      });
    });
  });
  return result;
}

function wrapContainerUnit(
  node: RenderContainerNode,
  unit: PaginationUnit,
  index: number,
): RenderContainerNode {
  return {
    ...node,
    renderId: `${node.renderId}/page-unit:${unit.id}`,
    style: index === 0 ? node.style : continuationStyle(node.style),
    children: [unit.node],
  };
}

function continuationStyle(style: RenderTreeNode["style"]): RenderTreeNode["style"] {
  if (!style) return style;
  const next = structuredClone(style);
  if (next.layout?.paddingPt) {
    next.layout.paddingPt = [0, next.layout.paddingPt[1], next.layout.paddingPt[2], next.layout.paddingPt[3]];
  }
  if (next.decoration?.borderEdges?.includes("top")) {
    next.decoration.borderEdges = next.decoration.borderEdges.filter((edge) => edge !== "top");
    if (!next.decoration.borderEdges.length) {
      delete next.decoration.borderWidthPt;
      delete next.decoration.borderColor;
      delete next.decoration.borderEdges;
    }
  }
  return next;
}

export function reconcileVisiblePages<T extends Pick<PaginationUnit, "id" | "keepWithNext" | "forcePageBreakBefore">>(
  pages: PaginatedPage<T>[],
  units: T[],
): PaginatedPage<T>[] {
  if (!units.length) return [{ id: "page-1", units: [], overflow: false }];
  if (!pages.length) return [{ id: "page-1", units, overflow: false }];
  const pageStarts = new Map(
    pages.slice(1).flatMap((page, index) =>
      page.units[0] ? [[page.units[0].id, index + 1] as const] : [],
    ),
  );
  const result: PaginatedPage<T>[] = [{
    id: pages[0].id,
    units: [],
    overflow: pages[0].overflow,
  }];
  units.forEach((unit) => {
    const pageIndex = pageStarts.get(unit.id);
    if (pageIndex !== undefined && result.at(-1)?.units.length) {
      result.push({
        id: pages[pageIndex]?.id ?? `page-${result.length + 1}`,
        units: [],
        overflow: pages[pageIndex]?.overflow ?? false,
      });
    }
    result.at(-1)!.units.push(unit);
  });
  return result;
}

export function paginate<T extends Pick<PaginationUnit, "id" | "keepWithNext" | "forcePageBreakBefore">>(
  units: T[],
  heights: Map<string, number>,
  capacity: number,
): PaginatedPage<T>[] {
  if (!units.length) return [{ id: "page-1", units: [], overflow: false }];
  const pages: PaginatedPage<T>[] = [];
  let current: T[] = [];
  let used = 0;
  let overflow = false;

  const flush = () => {
    pages.push({ id: `page-${pages.length + 1}`, units: current, overflow });
    current = [];
    used = 0;
    overflow = false;
  };

  units.forEach((unit, index) => {
    if (unit.forcePageBreakBefore && current.length) flush();
    const height = heights.get(unit.id) ?? 0;
    let required = height;
    let lookaheadIndex = index;
    let lookahead = unit;
    while (lookahead.keepWithNext && lookaheadIndex + 1 < units.length) {
      lookaheadIndex += 1;
      lookahead = units[lookaheadIndex];
      required += heights.get(lookahead.id) ?? 0;
    }
    if (current.length && used + required > capacity) flush();
    current.push(unit);
    used += height;
    if (height > capacity || used > capacity + 1) overflow = true;
  });
  if (current.length || !pages.length) flush();
  return pages;
}
