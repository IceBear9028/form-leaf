import {
  Fragment,
  useLayoutEffect,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import type {
  RichTextMark,
  RichTextValue,
} from "../../../../../foundation/documentModel.ts";
import type {
  DirectEditValue,
  DocumentEditTarget,
  TextRange,
} from "../../../../../foundation/documentEditing.ts";
import {
  documentEditTargetKey,
  replaceRichTextRange,
  replaceTextRange,
  richTextPlainText,
} from "../../../../../foundation/documentEditing.ts";
import { safeHref } from "./safeHref.ts";
import { colorToCss } from "./styleToCss.ts";

export type DirectTextSelection = {
  target: DocumentEditTarget;
  range: TextRange;
  rect: DOMRect;
};

export function EditableTextValue({
  hostProps,
  target,
  value,
  onChange,
  onRichTextSelection,
  selectionToRestore,
}: {
  hostProps: HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string | undefined>;
  target: DocumentEditTarget;
  value: DirectEditValue;
  onChange: (target: DocumentEditTarget, value: DirectEditValue, selection: TextRange) => void;
  onRichTextSelection?: (selection?: DirectTextSelection) => void;
  selectionToRestore?: DirectTextSelection;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const compositionSourceRef = useRef("");
  const pendingSelectionRef = useRef<TextRange | undefined>(undefined);
  const source = typeof value === "string" ? value : richTextPlainText(value);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const external = selectionToRestore &&
      documentEditTargetKey(selectionToRestore.target) === documentEditTargetKey(target)
      ? selectionToRestore.range
      : undefined;
    const pending = pendingSelectionRef.current ?? external;
    if (!root || !pending || !restoreTextSelection(root, pending)) return;
    pendingSelectionRef.current = undefined;
    if (typeof value !== "string") emitRichSelection(root, target, onRichTextSelection);
  }, [onRichTextSelection, selectionToRestore, source, target, value]);

  const commitReplacement = (range: TextRange, replacement: string) => {
    const result = typeof value === "string"
      ? replaceTextRange(value, range, replacement)
      : replaceRichTextRange(value, range, replacement);
    pendingSelectionRef.current = result.selection;
    onChange(target, result.value, result.selection);
  };

  const applyInput = (root: HTMLElement, inputType: string, data?: string) => {
    const range = readTextSelection(root);
    if (!range) return;
    if (inputType.startsWith("delete")) {
      const deletion = range.start === range.end
        ? adjacentTextRange(source, range.start, /Backward$/.test(inputType) ? "backward" : "forward")
        : range;
      if (deletion) commitReplacement(deletion, "");
      return;
    }
    const replacement = inputType === "insertParagraph" || inputType === "insertLineBreak"
      ? "\n"
      : data;
    if (replacement !== undefined) commitReplacement(range, replacement);
  };

  return (
    <div
      {...hostProps}
      ref={rootRef}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      role="textbox"
      aria-multiline="true"
      data-document-edit-target="true"
      data-placeholder={source ? undefined : "텍스트 입력"}
      onBeforeInput={(event) => {
        if (composingRef.current || event.nativeEvent.isComposing) return;
        event.preventDefault();
        applyInput(event.currentTarget, event.nativeEvent.inputType, event.nativeEvent.data ?? undefined);
      }}
      onPaste={(event) => {
        event.preventDefault();
        const range = readTextSelection(event.currentTarget);
        if (range) commitReplacement(range, event.clipboardData.getData("text/plain"));
      }}
      onCompositionStart={() => {
        composingRef.current = true;
        compositionSourceRef.current = source;
      }}
      onCompositionEnd={(event) => {
        composingRef.current = false;
        const next = event.currentTarget.textContent ?? "";
        const diff = textDiff(compositionSourceRef.current, next);
        if (diff) commitReplacement(diff.range, diff.replacement);
      }}
      onInput={(event) => {
        if (composingRef.current) return;
        const next = event.currentTarget.textContent ?? "";
        const diff = textDiff(source, next);
        if (diff) commitReplacement(diff.range, diff.replacement);
      }}
      onMouseUp={(event) => {
        hostProps.onMouseUp?.(event);
        if (typeof value !== "string") emitRichSelection(event.currentTarget, target, onRichTextSelection);
      }}
      onKeyUp={(event) => {
        hostProps.onKeyUp?.(event);
        if (typeof value !== "string") emitRichSelection(event.currentTarget, target, onRichTextSelection);
      }}
      onBlur={(event) => {
        hostProps.onBlur?.(event);
        onRichTextSelection?.(undefined);
      }}
    >
      {typeof value === "string"
        ? value
        : value.runs.map((run, index) => (
          <Fragment key={`${index}-${run.text.length}`}>
            {renderMarkedText(run.text, run.marks ?? [], `editable-run-${index}`)}
          </Fragment>
        ))}
    </div>
  );
}

function emitRichSelection(
  root: HTMLElement,
  target: DocumentEditTarget,
  onSelection?: (selection?: DirectTextSelection) => void,
) {
  if (!onSelection) return;
  const selection = window.getSelection();
  const range = readTextSelection(root);
  if (!selection || selection.isCollapsed || !range || range.start === range.end || !selection.rangeCount) {
    onSelection(undefined);
    return;
  }
  onSelection({ target, range, rect: selection.getRangeAt(0).getBoundingClientRect() });
}

function readTextSelection(root: HTMLElement): TextRange | undefined {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return undefined;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return undefined;
  return {
    start: textOffset(root, range.startContainer, range.startOffset),
    end: textOffset(root, range.endContainer, range.endOffset),
  };
}

function textOffset(root: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
}

function restoreTextSelection(root: HTMLElement, selection: TextRange): boolean {
  const start = textLocation(root, selection.start);
  const end = textLocation(root, selection.end);
  if (!start || !end) return false;
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  const domSelection = window.getSelection();
  domSelection?.removeAllRanges();
  domSelection?.addRange(range);
  root.focus({ preventScroll: true });
  return true;
}

function textLocation(root: HTMLElement, target: number): { node: Node; offset: number } | undefined {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent?.length ?? 0;
    if (target <= consumed + length) return { node, offset: Math.max(0, target - consumed) };
    consumed += length;
    node = walker.nextNode();
  }
  return target === 0 ? { node: root, offset: 0 } : undefined;
}

function adjacentTextRange(
  source: string,
  caret: number,
  direction: "backward" | "forward",
): TextRange | undefined {
  const segments = [...new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(source)];
  if (direction === "backward") {
    const segment = segments.filter((entry) => entry.index < caret).at(-1);
    return segment ? { start: segment.index, end: caret } : undefined;
  }
  const segment = segments.find((entry) => entry.index >= caret);
  return segment ? { start: caret, end: segment.index + segment.segment.length } : undefined;
}

function textDiff(before: string, after: string): { range: TextRange; replacement: string } | undefined {
  if (before === after) return undefined;
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start += 1;
  let beforeEnd = before.length;
  let afterEnd = after.length;
  while (beforeEnd > start && afterEnd > start && before[beforeEnd - 1] === after[afterEnd - 1]) {
    beforeEnd -= 1;
    afterEnd -= 1;
  }
  return { range: { start, end: beforeEnd }, replacement: after.slice(start, afterEnd) };
}

function renderMarkedText(text: string, marks: RichTextMark[], key: string): ReactNode {
  const byType = new Map(marks.map((mark) => [mark.type, mark]));
  let content: ReactNode = text;
  if (byType.has("bold")) content = <strong key={`${key}-bold`}>{content}</strong>;
  if (byType.has("italic")) content = <em key={`${key}-italic`}>{content}</em>;
  if (byType.has("underline")) content = <u key={`${key}-underline`}>{content}</u>;
  if (byType.has("strike")) content = <s key={`${key}-strike`}>{content}</s>;
  const color = byType.get("color");
  if (color?.type === "color") content = <span style={{ color: colorToCss(color.color) }}>{content}</span>;
  const link = byType.get("link");
  if (link?.type === "link") {
    const href = safeHref(link.href);
    content = href ? <a href={href} onClick={(event) => event.preventDefault()}>{content}</a> : content;
  }
  return content;
}
