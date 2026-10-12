import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
} from "react";
import type { DocumentEditTarget, TextRange } from "../../../../../foundation/documentEditing.ts";
import {
  replaceMarkdownRange,
  replaceMarkdownText,
  replaceMarkdownTextWithBlockShortcut,
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
  const sourceRef = useRef(source);
  const pendingSelectionRef = useRef<MarkdownSourceRange | undefined>(undefined);
  const [selection, setSelection] = useState<MarkdownDomSelection>();
  const blocks = parseMarkdownBlocks(source);
  const renderedBlocks = fragment
    ? fragment.blockIndexes.flatMap((index) => blocks[index] ? [blocks[index]] : [])
    : blocks;
  const sourceId = editTargetSourceId(target);
  sourceRef.current = source;

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
  }, [source, sourceId]);

  const updateSource = (
    edit: (current: string) => { source: string; selection: MarkdownSourceRange },
  ) => {
    const result = edit(sourceRef.current);
    if (result.source === sourceRef.current) return;
    sourceRef.current = result.source;
    pendingSelectionRef.current = result.selection;
    onChange(target, result.source, result.selection);
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
    <div {...hostProps} ref={rootRef} data-document-edit-target="true">
      {renderedBlocks.length ? renderedBlocks.map((block) => (
        <MarkdownBlockContent
          key={block.id}
          block={block}
          documentBlocks={blocks}
          context="document"
          idPrefix={`markdown-${sourceId}`}
          editing={{
            source,
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
        <MarkdownSelectionToolbar rect={selection.rect} onFormat={applyFormat} onLink={applyLink} />
      )}
    </div>
  );
}

function editTargetSourceId(target: DocumentEditTarget): string {
  if (target.kind === "node") return `node-${target.nodeId}`;
  if (target.kind === "component-prop") return `instance-${target.instanceNodeId}-prop-${target.propId}`;
  return `repeater-${target.repeaterNodeId}-item-${target.itemId}-prop-${target.propId}`;
}
