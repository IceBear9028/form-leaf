import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  ProfileSection,
  ProjectItem,
  ResumeDocument,
  ResumeLink,
  TextContent,
  TimelineItem,
  TimelineKind,
} from "../../../../../foundation/content/resume";
import { plainText } from "../../../../../foundation/content/resume";
import { parseResumeMarkdown, type ResumeMarkdownBlock } from "../markdown/parser";
import {
  replaceMarkdownRange,
  replaceMarkdownText,
  replaceMarkdownTextWithBlockShortcut,
  toggleMarkdownInlineFormat,
  toggleMarkdownLink,
  type MarkdownInlineFormat,
  type MarkdownSourceRange,
} from "../markdown/edits";
import { getResumeStyleSheet } from "./resumeStyleSheets";
import {
  MarkdownBlockContent,
  MarkdownFootnotesContent,
  type MarkdownContext,
} from "../markdown/MarkdownContent";
import { MarkdownSelectionToolbar } from "../markdown/MarkdownSelectionToolbar";

type MarkdownOwner = "introduction" | "project" | "career" | "education" | "activity" | "free-text";

type MarkdownSourceTarget = {
  sourceId: string;
  sectionId: string;
  itemId?: string;
};

type MarkdownLayoutUnit = {
  id: string;
  type: "markdown-block" | "markdown-footnotes";
  block?: ResumeMarkdownBlock;
  documentBlocks: ResumeMarkdownBlock[];
  context: MarkdownContext;
  owner: MarkdownOwner;
  sourceId: string;
  source: string;
  sourceTarget: MarkdownSourceTarget;
  lead?: boolean;
  keepWithNext?: boolean;
  lineSegment?: boolean;
  lineStart?: boolean;
  lineEnd?: boolean;
};

type LayoutUnit =
  | { id: string; type: "profile"; section: ProfileSection; keepWithNext?: boolean }
  | { id: string; type: "section-heading"; title: string; annotation?: string; sectionKind: "introduction" | TimelineKind | "project" | "side-project" | "free-text"; separator: boolean; keepWithNext: true; forceNewPage?: boolean }
  | { id: string; type: "timeline"; item: TimelineItem; timelineKind: TimelineKind; keepWithNext?: boolean; lineSegment?: boolean; lineStart?: boolean; lineEnd?: boolean }
  | { id: string; type: "project-header"; item: ProjectItem; keepWithNext?: boolean; lineSegment: true; lineStart: true; lineEnd?: boolean }
  | { id: string; type: "tech-stack"; items: string[]; lineSegment: true; lineStart?: boolean; lineEnd: boolean }
  | MarkdownLayoutUnit;

type Page = { id: string; units: LayoutUnit[]; overflow: boolean };

type PreviewMarkdownSelection = {
  sourceId: string;
  groupId: string;
  range: MarkdownSourceRange;
  rect: DOMRect;
};

type MarkdownDomSelection = PreviewMarkdownSelection;

type MarkdownHistoryEntry = {
  target: MarkdownSourceTarget;
  before: string;
  after: string;
  selectionBefore: MarkdownSourceRange;
  selectionAfter: MarkdownSourceRange;
  reason: "typing" | "format" | "link";
  at: number;
};

export function ResumePreview({ document, zoom, onChange }: {
  document: ResumeDocument;
  zoom: number;
  onChange: (change: ResumeDocument | ((current: ResumeDocument) => ResumeDocument)) => void;
}) {
  const styleSheet = getResumeStyleSheet(document.styleSheetId);
  const units = useMemo(() => buildUnits(document), [document]);
  const [pages, setPages] = useState<Page[]>(() => [{ id: "page-1", units, overflow: false }]);
  const measureRef = useRef<HTMLDivElement>(null);
  const capacityRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const pendingSelectionRef = useRef<{ sourceId: string; range: MarkdownSourceRange } | undefined>(undefined);
  const sourceCacheRef = useRef(new Map<string, string>());
  const undoRef = useRef<MarkdownHistoryEntry[]>([]);
  const redoRef = useRef<MarkdownHistoryEntry[]>([]);
  const [markdownSelection, setMarkdownSelection] = useState<PreviewMarkdownSelection>();

  units.forEach((unit) => {
    if (unit.type === "markdown-block" || unit.type === "markdown-footnotes") {
      sourceCacheRef.current.set(unit.sourceId, unit.source);
    }
  });

  useLayoutEffect(() => {
    let frame = requestAnimationFrame(() => {
      const container = measureRef.current;
      const capacity = capacityRef.current?.clientHeight ?? 0;
      if (!container || !capacity) return;

      const heights = new Map<string, number>();
      container.querySelectorAll<HTMLElement>("[data-measure-id]").forEach((element) => {
        heights.set(element.dataset.measureId ?? "", element.getBoundingClientRect().height);
      });
      setPages(paginate(units, heights, capacity));
    });

    const fonts = documentFontsReady();
    void fonts.then(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const container = measureRef.current;
        const capacity = capacityRef.current?.clientHeight ?? 0;
        if (!container || !capacity) return;
        const heights = new Map<string, number>();
        container.querySelectorAll<HTMLElement>("[data-measure-id]").forEach((element) => {
          heights.set(element.dataset.measureId ?? "", element.getBoundingClientRect().height);
        });
        setPages(paginate(units, heights, capacity));
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [units]);

  useEffect(() => {
    const updateSelection = () => {
      const root = previewRef.current;
      setMarkdownSelection(root ? readMarkdownSelection(root) : undefined);
    };
    globalThis.document.addEventListener("selectionchange", updateSelection);
    window.addEventListener("resize", updateSelection);
    return () => {
      globalThis.document.removeEventListener("selectionchange", updateSelection);
      window.removeEventListener("resize", updateSelection);
    };
  }, []);

  useLayoutEffect(() => {
    const pending = pendingSelectionRef.current;
    const root = previewRef.current;
    const visibleUnit = pending ? findMarkdownUnit(units, pending.sourceId) : undefined;
    if (
      !pending ||
      !root ||
      !visibleUnit ||
      visibleUnit.source !== sourceCacheRef.current.get(pending.sourceId) ||
      !restoreMarkdownSelection(root, pending.sourceId, pending.range)
    ) return;
    pendingSelectionRef.current = undefined;
    setMarkdownSelection(readMarkdownSelection(root));
  }, [pages, document, units]);

  const updateSource = (
    target: MarkdownSourceTarget,
    edit: (source: string) => { source: string; selection: MarkdownSourceRange },
    options?: {
      reason?: MarkdownHistoryEntry["reason"];
      selectionBefore?: MarkdownSourceRange;
      recordHistory?: boolean;
    },
  ) => {
    const currentSource = sourceCacheRef.current.get(target.sourceId) ?? "";
    const result = edit(currentSource);
    if (result.source === currentSource) return result;
    const reason = options?.reason ?? "typing";
    if (options?.recordHistory !== false) {
      recordMarkdownHistory(undoRef.current, {
        target,
        before: currentSource,
        after: result.source,
        selectionBefore: options?.selectionBefore ?? result.selection,
        selectionAfter: result.selection,
        reason,
        at: Date.now(),
      });
      redoRef.current = [];
    }
    sourceCacheRef.current.set(target.sourceId, result.source);
    pendingSelectionRef.current = { sourceId: target.sourceId, range: result.selection };
    onChange((current) => replaceMarkdownSource(current, target, result.source));
    return result;
  };

  const editText = (
    unit: MarkdownLayoutUnit,
    range: MarkdownSourceRange,
    visibleText: string,
    visibleSelection: MarkdownSourceRange,
  ): void => {
    updateSource(
      unit.sourceTarget,
      (source) => replaceMarkdownText(source, range, visibleText, visibleSelection),
      { reason: "typing", selectionBefore: range },
    );
  };

  const editFromInput = (
    unit: MarkdownLayoutUnit,
    root: HTMLElement,
    inputType: string,
    data?: string,
  ) => {
    const selection = readMarkdownSourceSelection(root, true);
    if (!selection || selection.sourceId !== unit.sourceId) return;
    let range = selection.range;

    if (inputType.startsWith("delete")) {
      if (range.start === range.end) {
        const direction = /Backward$/.test(inputType) ? "backward" : "forward";
        const source = sourceCacheRef.current.get(unit.sourceId) ?? unit.source;
        const granularity = /Word/.test(inputType)
          ? "word"
          : /Line/.test(inputType)
            ? "line"
            : "grapheme";
        const lineBoundary = granularity === "line"
          ? visualLineDeletionRange(root, direction)
          : undefined;
        const domSelection = window.getSelection();
        const anchorElement = domSelection?.anchorNode instanceof HTMLElement
          ? domSelection.anchorNode
          : domSelection?.anchorNode?.parentElement;
        const atEmptyBlock = Boolean(
          anchorElement?.closest(".markdown-empty-block") &&
          root.contains(anchorElement),
        );
        const backwardBreak = direction === "backward"
          ? source.slice(0, range.start).match(/<br\s*\/?>$/i)?.[0]
          : undefined;
        const forwardBreak = direction === "forward"
          ? source.slice(range.start).match(/^<br\s*\/?>/i)?.[0]
          : undefined;
        const adjacent = lineBoundary ?? (direction === "backward" && atEmptyBlock &&
          source.slice(range.start - 2, range.start) === "\n\n"
          ? { start: range.start - 2, end: range.start }
          : backwardBreak
          ? { start: range.start - backwardBreak.length, end: range.start }
          : forwardBreak
            ? { start: range.start, end: range.start + forwardBreak.length }
            : direction === "backward" && source[range.start - 1] === "\n"
              ? { start: range.start - 1, end: range.start }
              : direction === "forward" && source[range.start] === "\n"
                ? { start: range.start, end: range.start + 1 }
                : adjacentDeletionRange(root, selection, direction, granularity));
        if (!adjacent) return;
        range = adjacent;
      }
      updateSource(
        unit.sourceTarget,
        (source) => replaceMarkdownRange(source, range, ""),
        { reason: "typing", selectionBefore: selection.range },
      );
      return;
    }

    const isParagraphBreak = inputType === "insertParagraph";
    const isLineBreak = inputType === "insertLineBreak";
    const insertedText = isParagraphBreak
      ? "\n\n"
      : isLineBreak
        ? "<br>"
        : data;
    if (insertedText === undefined) return;
    if (isParagraphBreak && range.start === range.end) {
      const source = sourceCacheRef.current.get(unit.sourceId) ?? unit.source;
      let start = range.start;
      let end = range.end;
      while (start > 0 && /[ \t]/.test(source[start - 1] ?? "")) start -= 1;
      while (end < source.length && /[ \t]/.test(source[end] ?? "")) end += 1;
      range = { start, end };
    }
    if (/^[ \t]+$/.test(insertedText) && range.start === range.end) {
      const source = sourceCacheRef.current.get(unit.sourceId) ?? unit.source;
      const outsideFormat = whitespaceOffsetOutsideInlineFormat(root, range.start, source);
      if (outsideFormat !== undefined) {
        range = { start: outsideFormat, end: outsideFormat };
      }
    }
    if (
      (isParagraphBreak || isLineBreak) &&
      range.start === range.end &&
      unit.block?.node.position?.end.offset !== undefined
    ) {
      const mappedOffsets = Array.from(root.querySelectorAll<HTMLElement>("[data-markdown-source-map]"))
        .flatMap((element) => parseSourceMap(element.dataset.markdownSourceMap));
      const lastVisibleOffset = Math.max(...mappedOffsets);
      if (range.start === lastVisibleOffset && unit.block.node.position.end.offset > range.start) {
        range = {
          start: unit.block.node.position.end.offset,
          end: unit.block.node.position.end.offset,
        };
      }
    }
    updateSource(unit.sourceTarget, (source) =>
      isLineBreak
        ? replaceMarkdownRange(source, range, insertedText)
        : replaceMarkdownTextWithBlockShortcut(
            source,
            range,
            insertedText,
            { start: insertedText.length, end: insertedText.length },
          ),
      { reason: "typing", selectionBefore: selection.range },
    );
  };

  const applyFormat = (format: MarkdownInlineFormat) => {
    if (!markdownSelection) return;
    const unit = findMarkdownUnit(units, markdownSelection.sourceId);
    if (!unit) return;
    updateSource(
      unit.sourceTarget,
      (source) => toggleMarkdownInlineFormat(source, markdownSelection.range, format),
      { reason: "format", selectionBefore: markdownSelection.range },
    );
  };

  const applyLink = () => {
    if (!markdownSelection) return;
    const unit = findMarkdownUnit(units, markdownSelection.sourceId);
    if (!unit) return;
    const href = window.prompt("링크 URL을 입력하세요. 비워두면 링크가 제거됩니다.", "https://");
    if (href === null) return;
    updateSource(
      unit.sourceTarget,
      (source) => toggleMarkdownLink(source, markdownSelection.range, href.trim() || undefined),
      { reason: "link", selectionBefore: markdownSelection.range },
    );
  };

  const applyHistory = (direction: "undo" | "redo") => {
    const sourceStack = direction === "undo" ? undoRef.current : redoRef.current;
    const destinationStack = direction === "undo" ? redoRef.current : undoRef.current;
    const entry = sourceStack.pop();
    if (!entry) return;
    const expected = direction === "undo" ? entry.after : entry.before;
    const replacement = direction === "undo" ? entry.before : entry.after;
    const selection = direction === "undo" ? entry.selectionBefore : entry.selectionAfter;
    if (sourceCacheRef.current.get(entry.target.sourceId) !== expected) {
      sourceStack.length = 0;
      destinationStack.length = 0;
      return;
    }
    destinationStack.push(entry);
    sourceCacheRef.current.set(entry.target.sourceId, replacement);
    pendingSelectionRef.current = { sourceId: entry.target.sourceId, range: selection };
    onChange((current) => replaceMarkdownSource(current, entry.target, replacement));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const previewHasFocus = previewRef.current?.contains(globalThis.document.activeElement);
      if (modifier && previewHasFocus && (key === "z" || key === "y")) {
        event.preventDefault();
        applyHistory(key === "y" || event.shiftKey ? "redo" : "undo");
        return;
      }
      if (!markdownSelection || !modifier) return;
      const format: MarkdownInlineFormat | undefined = key === "b"
        ? "strong"
        : key === "i"
          ? "emphasis"
          : key === "u"
            ? "underline"
            : undefined;
      if (!format) return;
      event.preventDefault();
      applyFormat(format);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const visiblePages = reconcileVisiblePages(pages, units);

  return (
    <main ref={previewRef} className="preview-panel min-w-0 overflow-auto overscroll-contain bg-[#e9edf2] px-10 pb-[100px] pt-[34px] max-[1180px]:px-6" aria-label="A4 미리보기">
      <div className="measurement-root" aria-hidden="true">
        <div className={`resume-page measurement-page ${styleSheet.className}`} style={styleSheet.variables}>
          <div className="resume-page-body measurement-body" ref={capacityRef}>
            <div ref={measureRef}>
              {units.map((unit) => <LayoutUnitView key={unit.id} unit={unit} measure />)}
            </div>
          </div>
        </div>
      </div>
      <div className="preview-stack mx-auto w-max [zoom:var(--preview-zoom)]" style={{ "--preview-zoom": zoom } as React.CSSProperties}>
        {visiblePages.map((page, pageIndex) => (
          <article className={`resume-page ${styleSheet.className}${page.overflow ? " resume-page--overflow" : ""}`} style={styleSheet.variables} key={page.id}>
            <div className="resume-page-body">
              {page.units.map((unit, unitIndex) => (
                <LayoutUnitView
                  key={unit.id}
                  unit={unit}
                  firstOnPage={unitIndex === 0}
                  onTextEdit={editText}
                  onEditIntent={editFromInput}
                />
              ))}
              {!page.units.length && pageIndex === 0 && (
                <div className="empty-resume-hint">왼쪽 편집기에서 이력서 내용을 입력하세요.</div>
              )}
            </div>
            <footer className="resume-page-number">{pageIndex + 1} / {visiblePages.length}</footer>
          </article>
        ))}
      </div>
      {markdownSelection && (
        <MarkdownSelectionToolbar
          rect={markdownSelection.rect}
          onFormat={applyFormat}
          onLink={applyLink}
        />
      )}
    </main>
  );
}

function documentFontsReady(): Promise<FontFaceSet> {
  return document.fonts.ready;
}

function reconcileVisiblePages(pages: Page[], units: LayoutUnit[]): Page[] {
  if (!units.length) return [{ id: "page-1", units: [], overflow: false }];
  if (!pages.length) return [{ id: "page-1", units, overflow: false }];
  const pageStarts = new Map(
    pages.slice(1).flatMap((page, index) =>
      page.units[0] ? [[page.units[0].id, index + 1] as const] : [],
    ),
  );
  const result: Page[] = [{
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

function paginate(units: LayoutUnit[], heights: Map<string, number>, capacity: number): Page[] {
  if (!units.length) return [{ id: "page-1", units: [], overflow: false }];
  const pages: Page[] = [];
  let current: LayoutUnit[] = [];
  let used = 0;
  let overflow = false;

  const flush = () => {
    pages.push({ id: `page-${pages.length + 1}`, units: current, overflow });
    current = [];
    used = 0;
    overflow = false;
  };

  units.forEach((unit, index) => {
    if (unit.type === "section-heading" && unit.forceNewPage && current.length) flush();
    const height = heights.get(unit.id) ?? 0;
    let required = height;
    let lookaheadIndex = index;
    let lookahead = unit;
    while ("keepWithNext" in lookahead && lookahead.keepWithNext && lookaheadIndex + 1 < units.length) {
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

function hasText(content: TextContent): boolean {
  return plainText(content).trim().length > 0;
}

function safeHref(value: string): string | undefined {
  const trimmed = value.trim();
  return /^(https?:|mailto:)/i.test(trimmed) ? trimmed : undefined;
}

function buildUnits(document: ResumeDocument): LayoutUnit[] {
  const units: LayoutUnit[] = [];
  document.sections.forEach((section) => {
    if (!section.visible) return;
    if (section.type === "profile") {
      units.push({ id: section.id, type: "profile", section, keepWithNext: true });
      return;
    }
    if (section.type === "introduction") {
      const bodyUnits = markdownUnits({
        source: section.bodyMarkdown,
        sourceTarget: markdownSourceTarget(section.id),
        context: "introduction",
        owner: "introduction",
      });
      if (!bodyUnits.length) return;
      units.push({ id: `${section.id}-heading`, type: "section-heading", title: section.title, sectionKind: "introduction", separator: false, keepWithNext: true });
      units.push(...bodyUnits);
      return;
    }
    if (section.type === "timeline") {
      const items = section.items.filter((item) => item.visible);
      if (!items.length) return;
      units.push({
        id: `${section.id}-heading`,
        type: "section-heading",
        title: section.title,
        annotation: section.annotation,
        sectionKind: section.timelineKind,
        separator: true,
        keepWithNext: true,
        forceNewPage: section.timelineKind === "activity",
      });
      items.forEach((item) => {
        const usesDivider = section.timelineKind !== "education";
        const bodyUnits = markdownUnits({
          source: item.bodyMarkdown,
          sourceTarget: markdownSourceTarget(section.id, item.id),
          context: section.timelineKind,
          owner: section.timelineKind,
          lineSegment: usesDivider,
        });
        units.push({
          id: item.id,
          type: "timeline",
          item,
          timelineKind: section.timelineKind,
          keepWithNext: bodyUnits.length > 0,
          lineSegment: usesDivider,
          lineStart: usesDivider,
          lineEnd: usesDivider && bodyUnits.length === 0,
        });
        units.push(...bodyUnits);
      });
      return;
    }
    if (section.type === "project-group") {
      const items = section.items.filter((item) => item.visible).sort((a, b) => a.order - b.order);
      if (!items.length) return;
      units.push({ id: `${section.id}-heading`, type: "section-heading", title: section.title, sectionKind: section.groupKind, separator: true, keepWithNext: true });
      items.forEach((item) => {
        const bodyUnits = markdownUnits({
          source: item.bodyMarkdown,
          sourceTarget: markdownSourceTarget(section.id, item.id),
          context: section.groupKind,
          owner: "project",
          lineSegment: true,
          leadFirstParagraph: true,
        });
        const techStack = item.techStack.map((value) => value.trim()).filter(Boolean);
        const hasFollowingContent = bodyUnits.length > 0 || techStack.length > 0;
        if (techStack.length && bodyUnits.length) {
          bodyUnits[bodyUnits.length - 1].lineEnd = false;
        }
        units.push({ id: item.id, type: "project-header", item, keepWithNext: hasFollowingContent, lineSegment: true, lineStart: true, lineEnd: !hasFollowingContent });
        units.push(...bodyUnits);
        if (techStack.length) {
          units.push({ id: `${item.id}-tech-stack`, type: "tech-stack", items: techStack, lineSegment: true, lineEnd: true });
        }
      });
      return;
    }
    const bodyUnits = markdownUnits({
      source: section.bodyMarkdown,
      sourceTarget: markdownSourceTarget(section.id),
      context: "free-text",
      owner: "free-text",
      lineSegment: true,
      lineStart: true,
    });
    if (!bodyUnits.length) return;
    units.push({ id: `${section.id}-heading`, type: "section-heading", title: section.title, sectionKind: "free-text", separator: true, keepWithNext: true });
    units.push(...bodyUnits);
  });
  return units;
}

function markdownUnits({
  source,
  sourceTarget,
  context,
  owner,
  lineSegment = false,
  lineStart = false,
  leadFirstParagraph = false,
}: {
  source: string;
  sourceTarget: MarkdownSourceTarget;
  context: MarkdownContext;
  owner: MarkdownOwner;
  lineSegment?: boolean;
  lineStart?: boolean;
  leadFirstParagraph?: boolean;
}): MarkdownLayoutUnit[] {
  if (!source.trim()) return [];
  const { sourceId } = sourceTarget;
  const documentBlocks = parseResumeMarkdown(source);
  const visibleBlocks = documentBlocks.filter(({ node }) =>
    node.type !== "definition" && node.type !== "footnoteDefinition",
  );
  const firstParagraphId = visibleBlocks.find(({ node }) => node.type === "paragraph")?.id;
  const result: MarkdownLayoutUnit[] = visibleBlocks.map((block, index) => ({
    id: `${sourceId}-block-${index}`,
    type: "markdown-block",
    block,
    documentBlocks,
    context,
    owner,
    sourceId,
    source,
    sourceTarget,
    lead: leadFirstParagraph && block.id === firstParagraphId,
    keepWithNext: block.node.type === "heading",
    lineSegment,
    lineStart: lineSegment && lineStart && index === 0,
  }));
  if (documentBlocks.some(({ node }) => node.type === "footnoteDefinition")) {
    result.push({
      id: `${sourceId}-footnotes`,
      type: "markdown-footnotes",
      documentBlocks,
      context,
      owner,
      sourceId,
      source,
      sourceTarget,
      lineSegment,
      lineStart: lineSegment && lineStart && result.length === 0,
    });
  }
  if (lineSegment && result.length) result[result.length - 1].lineEnd = true;
  return result;
}

function markdownSourceTarget(sectionId: string, itemId?: string): MarkdownSourceTarget {
  return {
    sourceId: itemId ? `section:${sectionId}/item:${itemId}` : `section:${sectionId}`,
    sectionId,
    itemId,
  };
}

function recordMarkdownHistory(
  history: MarkdownHistoryEntry[],
  entry: MarkdownHistoryEntry,
): void {
  const previous = history.at(-1);
  const canMerge = previous &&
    previous.reason === "typing" &&
    entry.reason === "typing" &&
    previous.target.sourceId === entry.target.sourceId &&
    previous.after === entry.before &&
    entry.at - previous.at < 900;
  if (canMerge) {
    previous.after = entry.after;
    previous.selectionAfter = entry.selectionAfter;
    previous.at = entry.at;
    if (previous.before === previous.after) history.pop();
    return;
  }
  history.push(entry);
  if (history.length > 100) history.shift();
}

function replaceMarkdownSource(
  document: ResumeDocument,
  target: MarkdownSourceTarget,
  bodyMarkdown: string,
): ResumeDocument {
  return {
    ...document,
    sections: document.sections.map((section) => {
      if (section.id !== target.sectionId) return section;
      if (!target.itemId) {
        return section.type === "introduction" || section.type === "free-text"
          ? { ...section, bodyMarkdown }
          : section;
      }
      if (section.type === "timeline") {
        return {
          ...section,
          items: section.items.map((item) =>
            item.id === target.itemId ? { ...item, bodyMarkdown } : item,
          ),
        };
      }
      if (section.type === "project-group") {
        return {
          ...section,
          items: section.items.map((item) =>
            item.id === target.itemId ? { ...item, bodyMarkdown } : item,
          ),
        };
      }
      return section;
    }),
  };
}

function findMarkdownUnit(
  units: LayoutUnit[],
  sourceId: string,
): MarkdownLayoutUnit | undefined {
  return units.find((unit): unit is MarkdownLayoutUnit =>
    (unit.type === "markdown-block" || unit.type === "markdown-footnotes") &&
    unit.sourceId === sourceId,
  );
}

function readMarkdownSelection(root: HTMLElement): PreviewMarkdownSelection | undefined {
  const selection = readMarkdownSourceSelection(root, false);
  return selection?.range.start === selection?.range.end ? undefined : selection;
}

function readMarkdownSourceSelection(
  root: HTMLElement,
  allowCollapsed: boolean,
): MarkdownDomSelection | undefined {
  const selection = window.getSelection();
  if (!selection || (!allowCollapsed && selection.isCollapsed) || !selection.rangeCount) return undefined;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return undefined;
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
  const rect = range.getBoundingClientRect();
  return {
    sourceId: start.sourceId,
    groupId: start.groupId,
    range: sourceRange,
    rect,
  };
}

function markdownSourcePoint(
  node: Node,
  offset: number,
  mode: "start" | "end" | "caret",
): { sourceId: string; groupId: string; offset: number } | undefined {
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
): { sourceId: string; groupId: string; offset: number } | undefined {
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
): { sourceId: string; groupId: string; offset: number } | undefined {
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

function parseSourceMap(value?: string): number[] {
  return value?.split(",").map(Number).filter(Number.isFinite) ?? [];
}

function visualLineDeletionRange(
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

function whitespaceOffsetOutsideInlineFormat(
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

function adjacentDeletionRange(
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
    if (granularity === "grapheme") return candidates.at(-1);
    if (granularity === "line") return candidates.at(-1);
    let index = candidates.length - 1;
    while (index >= 0 && /\s/u.test(candidates[index].text)) index -= 1;
    while (index > 0 && !/\s/u.test(candidates[index - 1].text)) index -= 1;
    const first = candidates[index];
    const last = candidates.at(-1);
    return first && last ? { start: first.start, end: last.end } : undefined;
  }
  const candidates = graphemeRanges.filter((range) => range.start >= caret);
  if (granularity === "grapheme") return candidates[0];
  if (granularity === "line") return candidates[0];
  let index = 0;
  while (index < candidates.length && /\s/u.test(candidates[index].text)) index += 1;
  let endIndex = index;
  while (endIndex + 1 < candidates.length && !/\s/u.test(candidates[endIndex + 1].text)) endIndex += 1;
  const first = candidates[0];
  const last = candidates[endIndex];
  return first && last ? { start: first.start, end: last.end } : undefined;
}

function restoreMarkdownSelection(
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

function sourceCaretLocation(
  segments: HTMLElement[],
  sourceOffset: number,
): { element: HTMLElement; node: Node; offset: number } | undefined {
  const locations = segments.flatMap((element) => {
    const boundaries = parseSourceMap(element.dataset.markdownSourceMap);
    return boundaries.flatMap((offset, localOffset) => {
      const node = element.firstChild ?? element;
      return [{
        element,
        node,
        sourceOffset: offset,
        offset: Math.min(localOffset, node.textContent?.length ?? 0),
        atStart: localOffset === 0,
        isAnchor: element.classList.contains("markdown-caret-anchor"),
      }];
    });
  });
  const exactLocations = locations.filter((location) => location.sourceOffset === sourceOffset);
  const location = exactLocations.find(({ isAnchor }) => isAnchor)
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

function LayoutUnitView({
  unit,
  measure = false,
  firstOnPage = false,
  onTextEdit,
  onEditIntent,
}: {
  unit: LayoutUnit;
  measure?: boolean;
  firstOnPage?: boolean;
  onTextEdit?: (
    unit: MarkdownLayoutUnit,
    range: MarkdownSourceRange,
    visibleText: string,
    visibleSelection: MarkdownSourceRange,
  ) => void;
  onEditIntent?: (
    unit: MarkdownLayoutUnit,
    root: HTMLElement,
    inputType: string,
    data?: string,
  ) => void;
}) {
  const attributes = measure ? { "data-measure-id": unit.id } : {};
  const lineClasses = "lineSegment" in unit && unit.lineSegment
    ? ` layout-unit--line-segment${unit.lineStart ? " layout-unit--line-start" : ""}${unit.lineEnd ? " layout-unit--line-end" : ""}`
    : "";
  if (unit.type === "profile") {
    return <div className={`layout-unit layout-unit--profile${firstOnPage ? " layout-unit--first" : ""}`} {...attributes}><ProfileView section={unit.section} /></div>;
  }
  if (unit.type === "section-heading") {
    return (
      <div className={`layout-unit layout-unit--heading layout-unit--heading-${unit.sectionKind}${firstOnPage ? " layout-unit--first" : ""}${unit.separator ? " layout-unit--separator" : ""}`} {...attributes}>
        <div className="resume-section-heading"><h2>{unit.title}</h2>{unit.annotation && <strong>{unit.annotation}</strong>}</div>
      </div>
    );
  }
  if (unit.type === "timeline") {
    return <div className={`layout-unit layout-unit--item layout-unit--item-${unit.timelineKind}${unit.keepWithNext ? " layout-unit--has-blocks" : ""}${lineClasses}`} {...attributes}><TimelineView item={unit.item} kind={unit.timelineKind} /></div>;
  }
  if (unit.type === "project-header") {
    return <div className={`layout-unit layout-unit--project${unit.keepWithNext ? " layout-unit--has-blocks" : ""}${lineClasses}`} {...attributes}><ProjectHeader item={unit.item} /></div>;
  }
  if (unit.type === "tech-stack") {
    return (
      <div className={`layout-unit layout-unit--block${lineClasses}`} {...attributes}>
        <div className="resume-grid-row resume-grid-row--continuation resume-grid-row--project">
          <div className="resume-meta-column" />
          <div className="resume-body-column"><div className="tech-stack"><ToolIcon /><strong>{unit.items.join(", ")}</strong></div></div>
        </div>
      </div>
    );
  }
  const markdownContent = unit.type === "markdown-block" && unit.block
    ? (
        <MarkdownBlockContent
          block={unit.block}
          documentBlocks={unit.documentBlocks}
          context={unit.context}
          idPrefix={`markdown-${unit.sourceId}`}
          lead={unit.lead}
          editing={!measure && onTextEdit && onEditIntent ? {
            source: unit.source,
            sourceId: unit.sourceId,
            onTextEdit: (range, visibleText, visibleSelection) =>
              onTextEdit(unit, range, visibleText, visibleSelection),
            onEditIntent: (root, inputType, data) =>
              onEditIntent(unit, root, inputType, data),
          } : undefined}
        />
      )
    : (
        <MarkdownFootnotesContent
          documentBlocks={unit.documentBlocks}
          context={unit.context}
          idPrefix={`markdown-${unit.sourceId}`}
        />
      );
  if (unit.owner === "introduction") {
    return <div className="layout-unit layout-unit--paragraph layout-unit--markdown" {...attributes}>{markdownContent}</div>;
  }
  if (unit.owner === "education") {
    return <div className="layout-unit layout-unit--block layout-unit--markdown education-block" {...attributes}>{markdownContent}</div>;
  }
  return (
    <div className={`layout-unit layout-unit--block layout-unit--markdown${lineClasses}`} {...attributes}>
      <div className={`resume-grid-row resume-grid-row--continuation resume-grid-row--${unit.owner}`}>
        <div className="resume-meta-column" />
        <div className="resume-body-column">{markdownContent}</div>
      </div>
    </div>
  );
}

function ProfileView({ section }: { section: ProfileSection }) {
  return (
    <header className="resume-profile">
      <div className="profile-photo">
        {section.photoDataUrl ? <img src={section.photoDataUrl} alt="" /> : <ProfilePlaceholder />}
      </div>
      <div className="profile-identity">
        <p className="profile-role">{section.role || <span className="preview-placeholder">직무명</span>}</p>
        <h1>{section.name || <span className="preview-placeholder">이름</span>}</h1>
      </div>
      <div className="profile-contacts">
        {section.phone && <ContactRow label="Phone" value={section.phone} />}
        {section.email && <ContactRow label="Email" value={section.email} href={`mailto:${section.email}`} />}
        {section.links.some((link) => link.label || link.href) && (
          <div className="contact-row contact-row--links">
            <span>WebSite</span>
            <div>{section.links.filter((link) => link.label || link.href).map((link) => (
              <a key={link.id} href={safeHref(link.href)}><LinkGlyph label={link.label} href={link.href} />{link.label || link.href}</a>
            ))}</div>
          </div>
        )}
      </div>
    </header>
  );
}

function ProfilePlaceholder() {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="프로필 사진 없음">
      <circle cx="32" cy="24" r="12" />
      <path d="M11 58c2-13 10-19 21-19s19 6 21 19" />
    </svg>
  );
}

function ContactRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="contact-row">
      <span>{label}</span>
      {safeHref(href ?? "") ? <a href={safeHref(href ?? "")}>{value}</a> : <strong>{value}</strong>}
    </div>
  );
}

function TimelineView({ item, kind }: { item: TimelineItem; kind: TimelineKind }) {
  if (kind === "education") {
    const range = [item.period.start, item.period.end].filter(Boolean).join(" ~ ");
    return (
      <div className="education-item">
        {range && <span className="education-period">{range}</span>}
        <h3>{item.organization}{item.organization && hasText(item.title) ? " - " : ""}<RichText content={item.title} /></h3>
      </div>
    );
  }
  return (
    <div className="resume-grid-row">
      <MetaColumn period={item.period} organization={kind === "activity" ? item.organization : ""} links={item.links} />
      <div className="resume-body-column timeline-body">
        {kind === "career" && item.organization ? <h3>{item.organization}</h3> : <h3><RichText content={item.title} /></h3>}
        {kind === "career" && hasText(item.title) && <p className="timeline-subtitle"><RichText content={item.title} /></p>}
      </div>
    </div>
  );
}

function ProjectHeader({ item }: { item: ProjectItem }) {
  return (
    <div className="resume-grid-row">
      <MetaColumn period={item.period} organization={item.organization} links={item.links} />
      <div className="resume-body-column project-body">
        <h3><RichText content={item.title} /></h3>
      </div>
    </div>
  );
}

function MetaColumn({ period, organization, links }: { period: { start: string; end: string; label?: string }; organization: string; links: ResumeLink[] }) {
  const range = [period.start, period.end].filter(Boolean).join(" ~ ");
  return (
    <div className="resume-meta-column">
      {range && <strong className="meta-period">{range}</strong>}
      {period.label && <span className="meta-duration">{period.label}</span>}
      {organization && <span className="meta-organization">{organization}</span>}
      {links.filter((link) => link.label || link.href).map((link) => (
        <a className="meta-link" key={link.id} href={safeHref(link.href)}><span className="meta-link-icon"><LinkGlyph label={link.label} href={link.href} /></span><span>{link.label || link.href}</span></a>
      ))}
    </div>
  );
}

function LinkGlyph({ label, href }: { label: string; href: string }) {
  if (/github/i.test(label) || /github\.com/i.test(href)) {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .7a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2.2c-3.4.7-4.1-1.4-4.1-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6a4.7 4.7 0 0 1 1.2-3.2c-.1-.3-.5-1.6.1-3.2 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.9 0C17.1 5.3 18 5.6 18 5.6c.6 1.6.2 2.9.1 3.2a4.7 4.7 0 0 1 1.2 3.2c0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .7Z" /></svg>;
  }
  if (/app\s*store/i.test(label) || /apps\.apple\.com/i.test(href)) {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.7 12.8c0-2.4 2-3.6 2.1-3.7a4.5 4.5 0 0 0-3.5-1.9c-1.5-.2-2.9.9-3.6.9-.8 0-1.9-.9-3.1-.9A4.7 4.7 0 0 0 4.7 9.6c-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.8 2.5 3.1 2.4 1.2-.1 1.7-.8 3.2-.8s1.9.8 3.2.8 2.2-1.2 3-2.4a10.4 10.4 0 0 0 1.4-2.9 4.1 4.1 0 0 1-3.1-3.5ZM14.3 5.6a4.2 4.2 0 0 0 1-3 4.2 4.2 0 0 0-2.8 1.4 4 4 0 0 0-1 2.9 3.5 3.5 0 0 0 2.8-1.3Z" /></svg>;
  }
  if (/홈페이지|home/i.test(label)) {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.7 12 3l9 7.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-5.2v-7H9.7v7H4.5A1.5 1.5 0 0 1 3 20.5v-9.8Z" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2h11l5 5v15H4V2Zm10 2v5h4M9 10v7l6-3.5L9 10Z" /></svg>;
}

function ToolIcon() {
  return (
    <svg className="tech-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M9.8 1.1a4.1 4.1 0 0 0-4.7 5.3L1.4 10a2.8 2.8 0 1 0 4 4l3.7-3.7a4.1 4.1 0 0 0 5.3-4.7l-2.6 2.6-2.3-.6-.6-2.3 2.6-2.6a4 4 0 0 0-1.7-1.6ZM3.4 13.8a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Z" />
    </svg>
  );
}

function RichText({ content }: { content: TextContent }) {
  return <>{content.runs.map((run, index) => {
    let node: React.ReactNode = run.text;
    if (run.marks?.includes("strong")) node = <strong>{node}</strong>;
    if (run.marks?.includes("underline")) node = <u>{node}</u>;
    if (run.marks?.includes("link") && run.href) node = <a href={safeHref(run.href)}>{node}</a>;
    return <span key={index}>{node}</span>;
  })}</>;
}
