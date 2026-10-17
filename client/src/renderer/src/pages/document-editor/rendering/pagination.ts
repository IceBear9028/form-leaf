import { parseMarkdownBlocks } from "../markdown/parser.ts";
import type {
  RenderComponentNode,
  RenderContainerNode,
  RenderMarkdownNode,
  RenderRepeaterNode,
  RenderTreeNode,
} from "./renderTree.ts";
import { reuseRenderTree } from "./renderTree.ts";

const continuationStyleCache = new WeakMap<NonNullable<RenderTreeNode["style"]>, NonNullable<RenderTreeNode["style"]>>();
const fragmentStyleCache = new WeakMap<
  NonNullable<RenderTreeNode["style"]>,
  Map<string, NonNullable<RenderTreeNode["style"]>>
>();
const fixedOverlayStyleCache = new WeakMap<
  NonNullable<RenderTreeNode["style"]>,
  NonNullable<RenderTreeNode["style"]>
>();
const positionedRowStyleCache = new WeakMap<
  NonNullable<RenderTreeNode["style"]>,
  NonNullable<RenderTreeNode["style"]>
>();

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

  const flowRowUnits = splitFlowRow(node);
  if (flowRowUnits) return flowRowUnits;

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

/**
 * A horizontal row with fixed side columns and one growing content column must
 * paginate through the content column without flattening the stored tree.
 * Continuation units keep empty fixed-width placeholders so the content column
 * remains aligned, while the actual side content is rendered only once.
 */
function splitFlowRow(node: RenderContainerNode): PaginationUnit[] | undefined {
  if (node.style?.layout?.direction !== "row" || node.children.length < 2) return undefined;
  const flowIndex = node.children.findIndex((child) => (
    child.type === "container" && (child.style?.layout?.grow ?? 0) > 0
  ));
  if (flowIndex < 0) return undefined;
  if (node.children.some((child, index) => (
    index !== flowIndex && child.style?.layout?.width?.mode !== "fixed"
  ))) return undefined;

  const flow = node.children[flowIndex];
  if (flow.type !== "container") return undefined;
  const flowUnits = flow.children.flatMap(splitPaginationNode);
  if (flowUnits.length <= 1) return [unitFromNode(node)];

  return flowUnits.map((unit, index) => {
    const first = index === 0;
    const last = index === flowUnits.length - 1;
    const flowFragment: RenderContainerNode = {
      ...flow,
      renderId: `${flow.renderId}/flow-unit:${unit.id}`,
      style: fragmentStyle(flow.style, first, last),
      children: [unit.node],
    };
    const rowFragment: RenderContainerNode = {
      ...node,
      renderId: `${node.renderId}/flow-unit:${unit.id}`,
      style: positionedRowStyle(fragmentStyle(node.style, first, last)),
      children: node.children.flatMap((child, childIndex) => {
        if (childIndex === flowIndex) return [flowFragment];
        const placeholder = fixedColumnPlaceholder(child, index);
        return first ? [fixedColumnOverlay(child, index), placeholder] : [placeholder];
      }),
    };
    return {
      ...unit,
      id: rowFragment.renderId,
      node: rowFragment,
      forcePageBreakBefore: first
        ? node.style?.pagination?.forcePageBreakBefore ?? unit.forcePageBreakBefore
        : unit.forcePageBreakBefore,
    };
  });
}

function fixedColumnOverlay(node: RenderTreeNode, fragmentIndex: number): RenderTreeNode {
  return {
    ...node,
    renderId: `${node.renderId}/layout-overlay:${fragmentIndex}`,
    style: fixedOverlayStyle(node.style),
    layoutRole: "fixed-overlay",
    layoutFragmentIndex: fragmentIndex,
  };
}

function fixedColumnPlaceholder(node: RenderTreeNode, fragmentIndex: number): RenderContainerNode {
  return {
    renderId: `${node.renderId}/layout-placeholder:${fragmentIndex}`,
    sourceNodeId: `layout-placeholder:${node.sourceNodeId}`,
    type: "container",
    name: `${node.name} layout placeholder`,
    visible: true,
    style: node.style,
    layoutRole: "fixed-placeholder",
    layoutFragmentIndex: fragmentIndex,
    children: [],
  };
}

function fixedOverlayStyle(style: RenderTreeNode["style"]): RenderTreeNode["style"] {
  if (!style) return style;
  const cached = fixedOverlayStyleCache.get(style);
  if (cached) return cached;
  const next = structuredClone(style);
  next.layout ??= {};
  next.layout.position = "absolute";
  next.layout.topPt = 0;
  next.layout.leftPt = 0;
  fixedOverlayStyleCache.set(style, next);
  return next;
}

function positionedRowStyle(style: RenderTreeNode["style"]): RenderTreeNode["style"] {
  if (!style) return style;
  if (style.layout?.position === "relative") return style;
  const cached = positionedRowStyleCache.get(style);
  if (cached) return cached;
  const next = structuredClone(style);
  next.layout ??= {};
  next.layout.position = "relative";
  positionedRowStyleCache.set(style, next);
  return next;
}

function fragmentStyle(
  style: RenderTreeNode["style"],
  first: boolean,
  last: boolean,
): RenderTreeNode["style"] {
  if (!style || (first && last)) return style;
  const key = `${first ? "first" : "continuation"}:${last ? "last" : "open"}`;
  const cached = fragmentStyleCache.get(style)?.get(key);
  if (cached) return cached;
  const next = structuredClone(style);
  if (next.layout?.paddingPt) {
    next.layout.paddingPt = [
      first ? next.layout.paddingPt[0] : 0,
      next.layout.paddingPt[1],
      last ? next.layout.paddingPt[2] : 0,
      next.layout.paddingPt[3],
    ];
  }
  if (!first && next.decoration?.borderEdges?.includes("top")) {
    next.decoration.borderEdges = next.decoration.borderEdges.filter((edge) => edge !== "top");
    if (!next.decoration.borderEdges.length) {
      delete next.decoration.borderWidthPt;
      delete next.decoration.borderColor;
      delete next.decoration.borderEdges;
    }
  }
  const variants = fragmentStyleCache.get(style) ?? new Map();
  variants.set(key, next);
  fragmentStyleCache.set(style, variants);
  return next;
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
  const cached = continuationStyleCache.get(style);
  if (cached) return cached;
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
  continuationStyleCache.set(style, next);
  return next;
}

export function reusePaginationUnits(
  previous: readonly PaginationUnit[],
  next: readonly PaginationUnit[],
): PaginationUnit[] {
  const previousById = new Map(previous.map((unit) => [unit.id, unit]));
  return next.map((unit) => {
    const current = previousById.get(unit.id);
    if (!current) return unit;
    const node = reuseRenderTree(current.node, unit.node);
    return node === current.node &&
      current.keepTogether === unit.keepTogether &&
      current.keepWithNext === unit.keepWithNext &&
      current.forcePageBreakBefore === unit.forcePageBreakBefore
      ? current
      : { ...unit, node };
  });
}

export function samePaginatedPages<T extends Pick<PaginationUnit, "id" | "keepWithNext" | "forcePageBreakBefore">>(
  left: readonly PaginatedPage<T>[],
  right: readonly PaginatedPage<T>[],
): boolean {
  return left.length === right.length && left.every((page, pageIndex) => {
    const other = right[pageIndex];
    return Boolean(other) &&
      page.id === other.id &&
      page.overflow === other.overflow &&
      page.units.length === other.units.length &&
      page.units.every((unit, unitIndex) => unit === other.units[unitIndex]);
  });
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
