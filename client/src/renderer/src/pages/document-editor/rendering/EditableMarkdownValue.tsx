import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import type { DocumentEditTarget, TextRange } from "../../../../../foundation/documentEditing.ts";
import {
  replaceMarkdownRange,
  replaceMarkdownText,
  replaceMarkdownTextWithBlockShortcut,
  toggleMarkdownBlockquote,
  toggleMarkdownInlineFormat,
  toggleMarkdownLink,
  type MarkdownInlineFormat,
  type MarkdownSourceRange,
} from "../markdown/edits.ts";
import { parseMarkdownBlocks } from "../markdown/parser.ts";
import {
  adjacentDeletionRange,
  parseSourceMap,
  readMarkdownSelection,
  readMarkdownSourceSelection,
  restoreMarkdownSelection,
  visualLineDeletionRange,
  whitespaceOffsetOutsideInlineFormat,
  type MarkdownDomSelection,
} from "../markdown/sourceSelection.ts";
import {
  MarkdownBlockContent,
  MarkdownFootnotesContent,
} from "../markdown/MarkdownContent.tsx";
import { MarkdownSelectionToolbar } from "../markdown/MarkdownSelectionToolbar.tsx";
import type { RenderMarkdownNode } from "./renderTree.ts";
import { useBufferedStringEdit } from "./useBufferedEditValue.ts";

export function EditableMarkdownValue({
  hostProps,
  target,
  source,
  fragment,
  onChange,
}: {
  hostProps: HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string | undefined>;
  target: DocumentEditTarget;
  source: string;
  fragment?: RenderMarkdownNode["fragment"];
  onChange: (target: DocumentEditTarget, value: string, selection: TextRange) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pendingSelectionRef = useRef<MarkdownSourceRange | undefined>(undefined);
  const [selection, setSelection] = useState<MarkdownDomSelection>();
  const bufferedSource = useBufferedStringEdit(
    source,
    (nextSource, nextSelection) => onChange(target, nextSource, nextSelection),
  );
  const activeSource = bufferedSource.value;
  const sourceRef = bufferedSource.valueRef;
  const blocks = parseMarkdownBlocks(activeSource);
  const renderedBlocks = fragment
    ? fragment.blockIndexes.flatMap((index) => blocks[index] ? [blocks[index]] : [])
    : blocks;
  const sourceId = editTargetSourceId(target);
  const [focusedPage, setFocusedPage] = useState<HTMLElement>();
  const [focusRect, setFocusRect] = useState<MarkdownFocusRect>();

  useLayoutEffect(() => {
    if (!focusedPage) {
      setFocusRect(undefined);
      return;
    }
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const hosts = [...focusedPage.querySelectorAll<HTMLElement>("[data-markdown-edit-source-id]")]
          .filter((element) => element.dataset.markdownEditSourceId === sourceId);
        const previewViewport = focusedPage.closest(".paginated-document")?.parentElement?.getBoundingClientRect();
        const next = unionVisibleRects(
          hosts.map((element) => element.getBoundingClientRect()),
          previewViewport,
        );
        setFocusRect((current) => sameFocusRect(current, next) ? current : next);
      });
    };
    update();
    const observer = new ResizeObserver(update);
    focusedPage.querySelectorAll<HTMLElement>("[data-markdown-edit-source-id]").forEach((element) => {
      if (element.dataset.markdownEditSourceId === sourceId) observer.observe(element);
    });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [activeSource, focusedPage, sourceId]);

  useEffect(() => {
    const updateSelection = () => {
      const root = rootRef.current;
      setSelection(root ? readMarkdownSelection(root) : undefined);
    };
    document.addEventListener("selectionchange", updateSelection);
    window.addEventListener("resize", updateSelection);
    return () => {
      document.removeEventListener("selectionchange", updateSelection);
      window.removeEventListener("resize", updateSelection);
    };
  }, []);

  useLayoutEffect(() => {
    const pending = pendingSelectionRef.current;
    const root = rootRef.current;
    if (!pending || !root || !restoreMarkdownSelection(root, sourceId, pending)) return;
    pendingSelectionRef.current = undefined;
    setSelection(readMarkdownSelection(root));
  }, [activeSource, sourceId]);

  const updateSource = (
    edit: (current: string) => { source: string; selection: MarkdownSourceRange },
  ) => {
    const result = edit(sourceRef.current);
    if (result.source === sourceRef.current) return;
    pendingSelectionRef.current = result.selection;
    bufferedSource.update(result.source, result.selection);
  };

  const editText = (
    range: MarkdownSourceRange,
    visibleText: string,
    visibleSelection: MarkdownSourceRange,
  ) => updateSource((current) => replaceMarkdownText(current, range, visibleText, visibleSelection));

  const editFromInput = (root: HTMLElement, inputType: string, data?: string) => {
    const currentSelection = readMarkdownSourceSelection(root, true);
    if (!currentSelection || currentSelection.sourceId !== sourceId) return;
    let range = currentSelection.range;
    const current = sourceRef.current;

    if (inputType.startsWith("delete")) {
      if (range.start === range.end) {
        const direction = /Backward$/.test(inputType) ? "backward" : "forward";
        const granularity = /Word/.test(inputType) ? "word" : /Line/.test(inputType) ? "line" : "grapheme";
        const lineBoundary = granularity === "line" ? visualLineDeletionRange(root, direction) : undefined;
        const domSelection = window.getSelection();
        const anchorElement = domSelection?.anchorNode instanceof HTMLElement
          ? domSelection.anchorNode
          : domSelection?.anchorNode?.parentElement;
        const atEmptyBlock = Boolean(anchorElement?.closest(".markdown-empty-block") && root.contains(anchorElement));
        const backwardBreak = direction === "backward"
          ? current.slice(0, range.start).match(/<br\s*\/?>$/i)?.[0]
          : undefined;
        const forwardBreak = direction === "forward"
          ? current.slice(range.start).match(/^<br\s*\/?>/i)?.[0]
          : undefined;
        const adjacent = lineBoundary ?? (direction === "backward" && atEmptyBlock &&
          current.slice(range.start - 2, range.start) === "\n\n"
          ? { start: range.start - 2, end: range.start }
          : backwardBreak
            ? { start: range.start - backwardBreak.length, end: range.start }
            : forwardBreak
              ? { start: range.start, end: range.start + forwardBreak.length }
              : direction === "backward" && current[range.start - 1] === "\n"
                ? { start: range.start - 1, end: range.start }
                : direction === "forward" && current[range.start] === "\n"
                  ? { start: range.start, end: range.start + 1 }
                  : adjacentDeletionRange(root, currentSelection, direction, granularity));
        if (!adjacent) return;
        range = adjacent;
      }
      updateSource((value) => replaceMarkdownRange(value, range, ""));
      return;
    }

    const paragraphBreak = inputType === "insertParagraph";
    const lineBreak = inputType === "insertLineBreak";
    const insertedText = paragraphBreak ? "\n\n" : lineBreak ? "<br>" : data;
    if (insertedText === undefined) return;
    if (paragraphBreak && range.start === range.end) {
      let start = range.start;
      let end = range.end;
      while (start > 0 && /[ \t]/.test(current[start - 1] ?? "")) start -= 1;
      while (end < current.length && /[ \t]/.test(current[end] ?? "")) end += 1;
      range = { start, end };
    }
    if (/^[ \t]+$/.test(insertedText) && range.start === range.end) {
      const outside = whitespaceOffsetOutsideInlineFormat(root, range.start, current);
      if (outside !== undefined) range = { start: outside, end: outside };
    }
    const block = blocks.find((entry) => (
      entry.node.position?.start.offset !== undefined &&
      entry.node.position?.end.offset !== undefined &&
      range.start >= entry.node.position.start.offset &&
      range.start <= entry.node.position.end.offset
    ));
    if ((paragraphBreak || lineBreak) && range.start === range.end && block?.node.position?.end.offset !== undefined) {
      const mappedOffsets = Array.from(root.querySelectorAll<HTMLElement>("[data-markdown-source-map]"))
        .flatMap((element) => parseSourceMap(element.dataset.markdownSourceMap));
      const lastVisibleOffset = Math.max(...mappedOffsets);
      if (range.start === lastVisibleOffset && block.node.position.end.offset > range.start) {
        range = { start: block.node.position.end.offset, end: block.node.position.end.offset };
      }
    }
    updateSource((value) => lineBreak
      ? replaceMarkdownRange(value, range, insertedText)
      : replaceMarkdownTextWithBlockShortcut(
        value,
        range,
        insertedText,
        { start: insertedText.length, end: insertedText.length },
      ));
  };

  const applyFormat = (format: MarkdownInlineFormat) => {
    if (selection) updateSource((current) => toggleMarkdownInlineFormat(current, selection.range, format));
  };
  const applyLink = () => {
    if (!selection) return;
    const href = window.prompt("링크 URL을 입력하세요. 비워두면 링크가 제거됩니다.", "https://");
    if (href !== null) updateSource((current) => toggleMarkdownLink(current, selection.range, href.trim() || undefined));
  };
  const applyBlockquote = () => {
    if (selection) updateSource((current) => toggleMarkdownBlockquote(current, selection.range));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!rootRef.current?.contains(document.activeElement) || !selection || !(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      const format = key === "b" ? "strong" : key === "i" ? "emphasis" : key === "u" ? "underline" : undefined;
      if (!format) return;
      event.preventDefault();
      applyFormat(format);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div
      {...hostProps}
      ref={rootRef}
      data-document-edit-target="true"
      data-markdown-edit-source-id={sourceId}
      onFocusCapture={(event) => {
        setFocusedPage(event.currentTarget.closest<HTMLElement>(".document-page") ?? undefined);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) bufferedSource.flush();
        requestAnimationFrame(() => {
          const active = document.activeElement;
          const activeHost = active instanceof Element
            ? active.closest<HTMLElement>("[data-markdown-edit-source-id]")
            : undefined;
          if (activeHost?.dataset.markdownEditSourceId !== sourceId) setFocusedPage(undefined);
        });
      }}
    >
      {renderedBlocks.length ? renderedBlocks.map((block) => (
        <MarkdownBlockContent
          key={block.id}
          block={block}
          documentBlocks={blocks}
          context="document"
          idPrefix={`markdown-${sourceId}`}
          editing={{
            source: activeSource,
            sourceId,
            onTextEdit: editText,
            onEditIntent: editFromInput,
          }}
        />
      )) : (
        <div
          className="document-empty-editable"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label="Markdown 입력"
          data-placeholder="텍스트 입력"
          onBeforeInput={(event) => {
            event.preventDefault();
            const text = event.nativeEvent.inputType === "insertParagraph"
              ? "\n\n"
              : event.nativeEvent.inputType === "insertLineBreak"
                ? "<br>"
                : event.nativeEvent.data ?? "";
            updateSource((current) => replaceMarkdownRange(current, { start: 0, end: current.length }, text));
          }}
          onPaste={(event) => {
            event.preventDefault();
            updateSource((current) => replaceMarkdownRange(
              current,
              { start: 0, end: current.length },
              event.clipboardData.getData("text/plain"),
            ));
          }}
        />
      )}
      {(!fragment || fragment.last) && (
        <MarkdownFootnotesContent documentBlocks={blocks} context="document" idPrefix={`markdown-${sourceId}`} />
      )}
      {selection && (
        <MarkdownSelectionToolbar
          rect={selection.rect}
          onFormat={applyFormat}
          onLink={applyLink}
          onBlockquote={applyBlockquote}
        />
      )}
      {focusRect && createPortal(
        <div
          className="document-markdown-focus-ring"
          style={{
            top: focusRect.top,
            left: focusRect.left,
            width: focusRect.width,
            height: focusRect.height,
          } as CSSProperties}
          aria-hidden="true"
        />,
        document.body,
      )}
    </div>
  );
}

type MarkdownFocusRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function unionVisibleRects(rects: DOMRect[], clip?: DOMRect): MarkdownFocusRect | undefined {
  const visible = rects.filter((rect) => rect.width > 0 && rect.height > 0);
  if (!visible.length) return undefined;
  const left = Math.max(Math.min(...visible.map((rect) => rect.left)), clip?.left ?? -Infinity);
  const top = Math.max(Math.min(...visible.map((rect) => rect.top)), clip?.top ?? -Infinity);
  const right = Math.min(Math.max(...visible.map((rect) => rect.right)), clip?.right ?? Infinity);
  const bottom = Math.min(Math.max(...visible.map((rect) => rect.bottom)), clip?.bottom ?? Infinity);
  if (right <= left || bottom <= top) return undefined;
  return { top, left, width: right - left, height: bottom - top };
}

function sameFocusRect(
  left: MarkdownFocusRect | undefined,
  right: MarkdownFocusRect | undefined,
): boolean {
  return left?.top === right?.top &&
    left?.left === right?.left &&
    left?.width === right?.width &&
    left?.height === right?.height;
}

function editTargetSourceId(target: DocumentEditTarget): string {
  if (target.kind === "node") return `node-${target.nodeId}`;
  if (target.kind === "component-prop") return `instance-${target.instanceNodeId}-prop-${target.propId}`;
  return `repeater-${target.repeaterNodeId}-item-${target.itemId}-prop-${target.propId}`;
}
