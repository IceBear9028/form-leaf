import type { MarkdownSourceRange } from "./edits";

export type MarkdownDomSelection = {
  sourceId: string;
  groupId: string;
  range: MarkdownSourceRange;
  rect: DOMRect;
};

type MarkdownSourcePoint = {
  sourceId: string;
  groupId: string;
  offset: number;
};

export function readMarkdownSelection(
  root: HTMLElement,
): MarkdownDomSelection | undefined {
  const selection = readMarkdownSourceSelection(root, false);
  return selection?.range.start === selection?.range.end ? undefined : selection;
}

export function readMarkdownSourceSelection(
  root: HTMLElement,
  allowCollapsed: boolean,
): MarkdownDomSelection | undefined {
  const selection = window.getSelection();
  if (!selection || (!allowCollapsed && selection.isCollapsed) || !selection.rangeCount) {
    return undefined;
  }
  return readMarkdownSourceRange(root, selection.getRangeAt(0), allowCollapsed);
}

export function readMarkdownSourceRange(
  root: HTMLElement,
  range: AbstractRange,
  allowCollapsed: boolean,
): MarkdownDomSelection | undefined {
  if (!allowCollapsed && range.collapsed) return undefined;
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return undefined;
  const start = markdownSourcePoint(
    range.startContainer,
    range.startOffset,
    range.collapsed ? "caret" : "start",
  );
  const end = range.collapsed
    ? start
    : markdownSourcePoint(range.endContainer, range.endOffset, "end");
  if (!start || !end || start.sourceId !== end.sourceId || start.groupId !== end.groupId) {
    return undefined;
  }
  const sourceRange = {
    start: Math.min(start.offset, end.offset),
    end: Math.max(start.offset, end.offset),
  };
  if (!allowCollapsed && sourceRange.start === sourceRange.end) return undefined;
  return {
    sourceId: start.sourceId,
    groupId: start.groupId,
    range: sourceRange,
    rect: domRectForRange(range),
  };
}

function domRectForRange(range: AbstractRange): DOMRect {
  const domRange = document.createRange();
  domRange.setStart(range.startContainer, range.startOffset);
  domRange.setEnd(range.endContainer, range.endOffset);
  return domRange.getBoundingClientRect();
}

export function visualLineDeletionRange(
  root: HTMLElement,
  direction: "backward" | "forward",
): MarkdownSourceRange | undefined {
  const domSelection = window.getSelection();
  if (!domSelection?.rangeCount || !domSelection.isCollapsed) return undefined;
  const original = domSelection.getRangeAt(0).cloneRange();
  domSelection.modify("extend", direction, "lineboundary");
  const lineSelection = readMarkdownSourceSelection(root, true)?.range;
  domSelection.removeAllRanges();
  domSelection.addRange(original);
  return lineSelection && lineSelection.start !== lineSelection.end
    ? lineSelection
    : undefined;
}

export function whitespaceOffsetOutsideInlineFormat(
  root: HTMLElement,
  sourceOffset: number,
  source: string,
): number | undefined {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return undefined;
  const range = selection.getRangeAt(0);
  if (!range.collapsed || !root.contains(range.startContainer)) return undefined;
  let element = range.startContainer instanceof HTMLElement
    ? range.startContainer
    : range.startContainer.parentElement;
  let offset = sourceOffset;
  while (element && element !== root) {
    const tag = element.tagName;
    if (tag === "U" && source.slice(offset, offset + 2) === "++") {
      offset += 2;
    } else if (["STRONG", "EM", "DEL", "A"].includes(tag)) {
      const outerEnd = Number(element.dataset.markdownSourceOuterEnd);
      if (Number.isFinite(outerEnd) && outerEnd > offset) offset = outerEnd;
    }
    element = element.parentElement;
  }
  return offset > sourceOffset ? offset : undefined;
}

export function adjacentDeletionRange(
  root: HTMLElement,
  selection: MarkdownDomSelection,
  direction: "backward" | "forward",
  granularity: "grapheme" | "word" | "line",
): MarkdownSourceRange | undefined {
  const graphemeRanges: Array<MarkdownSourceRange & { text: string }> = [];
  const segments = Array.from(root.querySelectorAll<HTMLElement>("[data-markdown-source-id]"))
    .filter((element) =>
      element.dataset.markdownSourceId === selection.sourceId &&
      element.closest<HTMLElement>("[data-markdown-edit-group]")?.dataset.markdownEditGroup === selection.groupId,
    );

  for (const element of segments) {
    const boundaries = parseSourceMap(element.dataset.markdownSourceMap);
    const text = element.textContent ?? "";
    const graphemes = new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(text);
    for (const grapheme of graphemes) {
      const endIndex = grapheme.index + grapheme.segment.length;
      const start = boundaries[grapheme.index];
      const end = boundaries[endIndex];
      if (start !== undefined && end !== undefined && start !== end) {
        graphemeRanges.push({ start, end, text: grapheme.segment });
      }
    }
  }

  const caret = selection.range.start;
  if (direction === "backward") {
    const candidates = graphemeRanges.filter((range) => range.end <= caret);
    if (granularity === "grapheme" || granularity === "line") return candidates.at(-1);
    let index = candidates.length - 1;
    while (index >= 0 && /\s/u.test(candidates[index].text)) index -= 1;
    while (index > 0 && !/\s/u.test(candidates[index - 1].text)) index -= 1;
    const first = candidates[index];
    const last = candidates.at(-1);
    return first && last ? { start: first.start, end: last.end } : undefined;
  }
  const candidates = graphemeRanges.filter((range) => range.start >= caret);
  if (granularity === "grapheme" || granularity === "line") return candidates[0];
  let index = 0;
  while (index < candidates.length && /\s/u.test(candidates[index].text)) index += 1;
  let endIndex = index;
  while (endIndex + 1 < candidates.length && !/\s/u.test(candidates[endIndex + 1].text)) {
    endIndex += 1;
  }
  const first = candidates[0];
  const last = candidates[endIndex];
  return first && last ? { start: first.start, end: last.end } : undefined;
}

export function restoreMarkdownSelection(
  root: HTMLElement,
  sourceId: string,
  sourceRange: MarkdownSourceRange,
): boolean {
  const segments = Array.from(root.querySelectorAll<HTMLElement>("[data-markdown-source-id]"))
    .filter((segment) => segment.dataset.markdownSourceId === sourceId);
  if (sourceRange.start === sourceRange.end) {
    const caret = sourceCaretLocation(segments, sourceRange.start);
    if (!caret) return false;
    caret.element.closest<HTMLElement>("[data-markdown-editable-block]")?.focus({ preventScroll: true });
    const range = globalThis.document.createRange();
    range.setStart(caret.node, caret.offset);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return true;
  }
  const start = sourceLocation(segments, sourceRange.start, false);
  const end = sourceLocation(segments, sourceRange.end, true);
  if (!start || !end) return false;
  const range = globalThis.document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  end.element.closest<HTMLElement>("[data-markdown-editable-block]")?.focus({ preventScroll: true });
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return true;
}

function markdownSourcePoint(
  node: Node,
  offset: number,
  mode: "start" | "end" | "caret",
): MarkdownSourcePoint | undefined {
  const directSegment = node.nodeType === Node.TEXT_NODE
    ? node.parentElement?.closest<HTMLElement>("[data-markdown-source-map]") ?? undefined
    : node instanceof HTMLElement && node.dataset.markdownSourceMap
      ? node
      : undefined;
  if (directSegment) {
    return sourcePointFromSegment(
      directSegment,
      textOffsetWithin(directSegment, node, offset, mode === "end"),
    );
  }

  if (node instanceof HTMLElement) {
    const previousNode = offset > 0 ? node.childNodes[offset - 1] : undefined;
    const nextNode = offset < node.childNodes.length ? node.childNodes[offset] : undefined;
    const previous = sourceBoundaryFromNode(previousNode, "end");
    const next = sourceBoundaryFromNode(nextNode, "start");
    if (mode === "start") return next ?? previous;
    return previous ?? next;
  }

  const segment = sourceSegmentFromNode(node, mode === "end");
  if (!segment) return undefined;
  const boundaries = parseSourceMap(segment.dataset.markdownSourceMap);
  return sourcePointFromSegment(segment, mode === "end" ? boundaries.length - 1 : 0);
}

function sourceBoundaryFromNode(
  node: Node | undefined,
  boundary: "start" | "end",
): MarkdownSourcePoint | undefined {
  if (!node) return undefined;
  const element = node instanceof HTMLElement ? node : node.parentElement;
  const outerValue = element?.dataset[
    boundary === "start" ? "markdownSourceOuterStart" : "markdownSourceOuterEnd"
  ];
  const segment = sourceSegmentFromNode(node, boundary === "end");
  if (!segment) return undefined;
  const point = sourcePointFromSegment(
    segment,
    boundary === "end" ? parseSourceMap(segment.dataset.markdownSourceMap).length - 1 : 0,
  );
  if (!point) return undefined;
  const outerOffset = outerValue === undefined ? undefined : Number(outerValue);
  return Number.isFinite(outerOffset) ? { ...point, offset: outerOffset! } : point;
}

function sourceSegmentFromNode(node: Node, preferEnd: boolean): HTMLElement | undefined {
  const element = node instanceof HTMLElement ? node : node.parentElement;
  if (!element) return undefined;
  if (element.dataset.markdownSourceMap) return element;
  const segments = element.querySelectorAll<HTMLElement>("[data-markdown-source-map]");
  if (!segments.length) return undefined;
  return preferEnd ? segments.item(segments.length - 1) : segments.item(0);
}

function sourcePointFromSegment(
  segment: HTMLElement,
  localOffset: number,
): MarkdownSourcePoint | undefined {
  const sourceId = segment.dataset.markdownSourceId;
  const groupId = segment.closest<HTMLElement>("[data-markdown-edit-group]")?.dataset.markdownEditGroup;
  const boundaries = parseSourceMap(segment.dataset.markdownSourceMap);
  if (!sourceId || !groupId || !boundaries.length) return undefined;
  return {
    sourceId,
    groupId,
    offset: boundaries[Math.max(0, Math.min(boundaries.length - 1, localOffset))],
  };
}

function textOffsetWithin(
  segment: HTMLElement,
  node: Node,
  offset: number,
  preferEnd: boolean,
): number {
  if (!segment.contains(node) && segment !== node) {
    return preferEnd ? segment.textContent?.length ?? 0 : 0;
  }
  const range = globalThis.document.createRange();
  range.selectNodeContents(segment);
  try {
    range.setEnd(node, offset);
    return range.toString().length;
  } catch {
    return preferEnd ? segment.textContent?.length ?? 0 : 0;
  }
}

export function parseSourceMap(value?: string): number[] {
  return value?.split(",").map(Number).filter(Number.isFinite) ?? [];
}

function sourceCaretLocation(
  segments: HTMLElement[],
  sourceOffset: number,
): { element: HTMLElement; node: Node; offset: number } | undefined {
  const locations = segments.flatMap((element) => {
    const boundaries = parseSourceMap(element.dataset.markdownSourceMap);
    return boundaries.map((offset, localOffset) => {
      const node = element.firstChild ?? element;
      return {
        element,
        node,
        sourceOffset: offset,
        offset: Math.min(localOffset, node.textContent?.length ?? 0),
        atStart: localOffset === 0,
        atEnd: localOffset === boundaries.length - 1,
        isAnchor: element.classList.contains("markdown-caret-anchor"),
        isHardBreak: element.classList.contains("markdown-hard-break"),
      };
    });
  });
  const exactLocations = locations.filter((location) => location.sourceOffset === sourceOffset);
  const location = exactLocations.find(({ isAnchor }) => isAnchor)
    ?? exactLocations.find(({ atStart, isHardBreak }) => atStart && !isHardBreak)
    ?? exactLocations.find(({ atEnd, isHardBreak }) => atEnd && !isHardBreak)
    ?? exactLocations.find(({ atStart }) => atStart)
    ?? exactLocations.at(-1)
    ?? locations
      .filter((candidate) => candidate.sourceOffset < sourceOffset)
      .sort((left, right) => right.sourceOffset - left.sourceOffset)[0]
    ?? locations
      .filter((candidate) => candidate.sourceOffset > sourceOffset)
      .sort((left, right) => left.sourceOffset - right.sourceOffset)[0];
  return location && {
    element: location.element,
    node: location.node,
    offset: location.offset,
  };
}

function sourceLocation(
  segments: HTMLElement[],
  sourceOffset: number,
  preferEnd: boolean,
): { element: HTMLElement; node: Node; offset: number } | undefined {
  const candidates = preferEnd ? [...segments].reverse() : segments;
  for (const element of candidates) {
    const boundaries = parseSourceMap(element.dataset.markdownSourceMap);
    const exact = preferEnd ? boundaries.lastIndexOf(sourceOffset) : boundaries.indexOf(sourceOffset);
    if (exact < 0) continue;
    const node = element.firstChild ?? element;
    return { element, node, offset: Math.min(exact, node.textContent?.length ?? 0) };
  }
  return undefined;
}
