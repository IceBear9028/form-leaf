import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
} from "react";
import type { DocumentEditTarget, TextRange } from "../../../../../foundation/documentEditing.ts";
import {
  applyMarkdownCommand,
  applyMarkdownQuickInsertCommand,
  deleteMarkdownBackwardAtBlockStart,
  findMarkdownQuickInsertTrigger,
  indentMarkdownListItem,
  insertMarkdownTextWithFormats,
  insertMarkdownParagraphBreak,
  replaceMarkdownRange,
  replaceMarkdownTextWithInputRules,
  setMarkdownTaskItemChecked,
  type MarkdownCommand,
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
  MarkdownEmptyContent,
  MarkdownFootnotesContent,
  type MarkdownEditingContext,
} from "../markdown/MarkdownContent.tsx";
import { MarkdownSelectionToolbar } from "../markdown/MarkdownSelectionToolbar.tsx";
import { MarkdownQuickInsertMenu } from "../markdown/MarkdownQuickInsertMenu.tsx";
import type { RenderMarkdownNode } from "./renderTree.ts";
import { useBufferedStringEdit } from "./useBufferedEditValue.ts";
import {
  interactionDebugEnabled,
  recordInteraction,
  snapshotEventTarget,
} from "../interactionDebug.ts";

const pendingMarkdownSelections = new Map<string, {
  range: MarkdownSourceRange;
  ownerRenderId: string;
  timeout: ReturnType<typeof setTimeout>;
}>();
type MarkdownHistoryEntry = { source: string; selection: MarkdownSourceRange };
const markdownEditHistories = new Map<string, {
  undo: MarkdownHistoryEntry[];
  redo: MarkdownHistoryEntry[];
}>();

function markdownHistory(sourceId: string) {
  const existing = markdownEditHistories.get(sourceId);
  if (existing) return existing;
  const created = { undo: [], redo: [] };
  markdownEditHistories.set(sourceId, created);
  return created;
}

function queueMarkdownSelection(
  sourceId: string,
  range: MarkdownSourceRange,
  ownerRenderId: string,
) {
  const current = pendingMarkdownSelections.get(sourceId);
  if (current) clearTimeout(current.timeout);
  const pending = {
    range,
    ownerRenderId,
    timeout: setTimeout(() => {
      if (pendingMarkdownSelections.get(sourceId) === pending) {
        pendingMarkdownSelections.delete(sourceId);
      }
    }, 2_000),
  };
  pendingMarkdownSelections.set(sourceId, pending);
}

function consumeMarkdownSelection(
  sourceId: string,
  pending: NonNullable<ReturnType<typeof pendingMarkdownSelections.get>>,
) {
  if (pendingMarkdownSelections.get(sourceId) !== pending) return;
  clearTimeout(pending.timeout);
  pendingMarkdownSelections.delete(sourceId);
}

export function EditableMarkdownValue({
  hostProps,
  target,
  renderId,
  source,
  fragment,
  onActivateTarget,
  onChange,
}: {
  hostProps: HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string | undefined>;
  target: DocumentEditTarget;
  renderId: string;
  source: string;
  fragment?: RenderMarkdownNode["fragment"];
  onActivateTarget?: (target: DocumentEditTarget, renderId: string, event?: Event) => void;
  onChange: (target: DocumentEditTarget, value: string, selection: TextRange) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pendingInlineFormatsRef = useRef(new Set<MarkdownInlineFormat>());
  const committedCompositionRef = useRef<string | undefined>(undefined);
  const [selection, setSelection] = useState<MarkdownDomSelection>();
  const [caretSelection, setCaretSelection] = useState<MarkdownDomSelection>();
  const [dismissedQuickInsertAt, setDismissedQuickInsertAt] = useState<number>();
  const bufferedSource = useBufferedStringEdit(
    source,
    (nextSource, nextSelection) => onChange(target, nextSource, nextSelection),
  );
  const activeSource = bufferedSource.value;
  const sourceRef = bufferedSource.valueRef;
  const sourceId = editTargetSourceId(target);
  const blocks = parseMarkdownBlocks(activeSource);
  const pendingSelection = pendingMarkdownSelections.get(sourceId);
  const transientEditedBlock = fragment && activeSource !== source &&
      pendingSelection?.ownerRenderId === renderId
    ? markdownBlockContainingRange(blocks, pendingSelection.range)
    : undefined;
  const renderedBlocks = transientEditedBlock
    ? [transientEditedBlock]
    : fragment
    ? fragment.blockIndexes.flatMap((index) => blocks[index] ? [blocks[index]] : [])
    : blocks;

  useEffect(() => {
    const updateSelection = () => {
      const root = rootRef.current;
      setSelection(root ? readMarkdownSelection(root) : undefined);
      setCaretSelection(root ? readMarkdownSourceSelection(root, true) : undefined);
    };
    document.addEventListener("selectionchange", updateSelection);
    window.addEventListener("resize", updateSelection);
    return () => {
      document.removeEventListener("selectionchange", updateSelection);
      window.removeEventListener("resize", updateSelection);
    };
  }, []);

  useLayoutEffect(() => {
    const pendingEntry = pendingMarkdownSelections.get(sourceId);
    const root = rootRef.current;
    if (!pendingEntry || !root) return;
    const pending = pendingEntry.range;
    const roots = [root, ...Array.from(
      document.querySelectorAll<HTMLElement>("[data-markdown-edit-source-id]"),
    ).filter((candidate) => (
      candidate !== root && candidate.dataset.markdownEditSourceId === sourceId
    ))];
    const exactRoots = roots.filter((candidate) => (
      rootContainsMarkdownRange(candidate, sourceId, pending)
    ));
    const composingRoot = roots.find((candidate) => (
      candidate.querySelector('[data-markdown-composing="true"]')
    ));
    if (composingRoot) {
      if (interactionDebugEnabled()) {
        recordInteraction("markdown-render", {
          sourceId,
          pending,
          ownerRenderId: pendingEntry.ownerRenderId,
          skipped: "composition-active",
          activeElement: snapshotEventTarget(document.activeElement),
        });
      }
      return;
    }
    const restoreOwner = exactRoots.find((candidate) => (
      candidate.dataset.documentRenderId === pendingEntry.ownerRenderId
    )) ?? exactRoots.find((candidate) => (
      candidate.dataset.documentEditActive === "true"
    )) ?? exactRoots[0];
    if (restoreOwner && restoreOwner !== root) return;
    const restoredRoot = restoreOwner && restoreMarkdownSelection(restoreOwner, sourceId, pending)
      ? restoreOwner
      : undefined;
    if (interactionDebugEnabled()) {
      const renderRoot = restoredRoot ?? root;
      recordInteraction("markdown-render", {
        sourceId,
        pending,
        rootCount: roots.length,
        exactRootCount: exactRoots.length,
        ownerRenderId: pendingEntry.ownerRenderId,
        transientBlockRemap: Boolean(transientEditedBlock),
        restored: Boolean(restoredRoot),
        activeElement: snapshotEventTarget(document.activeElement),
        source: markdownSourceDebugSummary(activeSource, pending.end),
        renderedBlocks: Array.from(
          renderRoot.querySelectorAll<HTMLElement>("[data-markdown-block]"),
        ).map((element) => ({
          type: element.dataset.markdownBlock,
          tag: element.tagName.toLowerCase(),
          editableGroup: element.dataset.markdownEditGroup,
        })),
      });
    }
    if (!restoredRoot) return;
    setSelection(readMarkdownSelection(restoredRoot));
    setCaretSelection(readMarkdownSourceSelection(restoredRoot, true));
    if (activeSource === source) consumeMarkdownSelection(sourceId, pendingEntry);
  }, [activeSource, renderId, source, sourceId, transientEditedBlock]);

  const quickInsertTrigger = caretSelection?.sourceId === sourceId
    ? findMarkdownQuickInsertTrigger(activeSource, caretSelection.range)
    : undefined;
  const quickInsertOpen = quickInsertTrigger &&
    quickInsertTrigger.range.start !== dismissedQuickInsertAt;

  useEffect(() => {
    if (!quickInsertTrigger) setDismissedQuickInsertAt(undefined);
  }, [quickInsertTrigger]);

  const updateSource = (
    edit: (current: string) => { source: string; selection: MarkdownSourceRange },
    recordHistory = true,
  ) => {
    const current = sourceRef.current;
    const currentRange = rootRef.current
      ? readMarkdownSourceSelection(rootRef.current, true)?.range
      : undefined;
    const result = edit(current);
    if (interactionDebugEnabled()) {
      recordInteraction("markdown-transaction", {
        sourceId,
        changed: result.source !== current,
        before: markdownSourceDebugSummary(
          current,
          currentRange?.end ?? result.selection.end,
        ),
        after: markdownSourceDebugSummary(result.source, result.selection.end),
        selection: result.selection,
      });
    }
    if (result.source === current) return;
    if (recordHistory) {
      const history = markdownHistory(sourceId);
      history.undo.push({ source: current, selection: currentRange ?? result.selection });
      if (history.undo.length > 100) history.undo.shift();
      history.redo = [];
    }
    queueMarkdownSelection(sourceId, result.selection, renderId);
    bufferedSource.update(result.source, result.selection);
  };

  const applyHistory = (direction: "undo" | "redo") => {
    const history = markdownHistory(sourceId);
    const sourceStack = direction === "undo" ? history.undo : history.redo;
    const destinationStack = direction === "undo" ? history.redo : history.undo;
    const entry = sourceStack.pop();
    if (!entry) return;
    const currentRange = rootRef.current
      ? readMarkdownSourceSelection(rootRef.current, true)?.range
      : undefined;
    destinationStack.push({
      source: sourceRef.current,
      selection: currentRange ?? entry.selection,
    });
    updateSource(() => entry, false);
  };

  const editFromInput = (
    root: HTMLElement,
    inputType: string,
    data?: string,
    targetSelection?: MarkdownDomSelection,
  ) => {
    if (inputType === "historyUndo" || inputType === "historyRedo") {
      applyHistory(inputType === "historyUndo" ? "undo" : "redo");
      return;
    }
    const sourceSelection = targetSelection ?? readMarkdownSourceSelection(root, true) ?? (
      sourceRef.current.length === 0 && root.contains(document.activeElement)
        ? {
            sourceId,
            groupId: `${sourceId}:empty`,
            range: { start: 0, end: 0 },
            rect: root.getBoundingClientRect(),
          }
        : undefined
    );
    const queuedSelection = pendingMarkdownSelections.get(sourceId);
    const queuedRange = sourceRef.current !== activeSource &&
      queuedSelection?.ownerRenderId === renderId
      ? queuedSelection.range
      : undefined;
    const currentSelection = sourceSelection && queuedRange
      ? { ...sourceSelection, range: queuedRange }
      : sourceSelection;
    if (interactionDebugEnabled()) {
      recordInteraction("markdown-input", {
        sourceId,
        inputType,
        dataKind: data === undefined ? "none" : data === " " ? "space" : "text",
        dataLength: data?.length ?? 0,
        selection: currentSelection?.range,
        selectionSourceMatches: currentSelection?.sourceId === sourceId,
        activeElement: snapshotEventTarget(document.activeElement),
        source: markdownSourceDebugSummary(
          sourceRef.current,
          currentSelection?.range.end ?? 0,
        ),
      });
    }
    if (!currentSelection || currentSelection.sourceId !== sourceId) return;
    let range = currentSelection.range;
    const current = sourceRef.current;
    const inputCommand: MarkdownCommand | undefined = inputType === "formatBold"
      ? { type: "inline-format", format: "strong" }
      : inputType === "formatItalic"
        ? { type: "inline-format", format: "emphasis" }
        : inputType === "formatUnderline"
          ? { type: "inline-format", format: "underline" }
          : inputType === "formatStrikeThrough"
            ? { type: "inline-format", format: "delete" }
            : inputType === "formatRemove"
              ? { type: "clear-formatting" }
              : inputType === "insertOrderedList"
                ? { type: "list", style: "ordered" }
                : inputType === "insertUnorderedList"
                  ? { type: "list", style: "unordered" }
                  : inputType === "insertHorizontalRule"
                    ? { type: "divider" }
                    : undefined;
    if (inputCommand) {
      if (range.start === range.end && inputCommand.type === "inline-format") {
        const pending = pendingInlineFormatsRef.current;
        if (pending.has(inputCommand.format)) pending.delete(inputCommand.format);
        else pending.add(inputCommand.format);
        return;
      }
      if (range.start === range.end && inputCommand.type === "clear-formatting") {
        pendingInlineFormatsRef.current.clear();
        return;
      }
      updateSource((value) => applyMarkdownCommand(value, range, inputCommand));
      return;
    }
    const domSelection = window.getSelection();
    const anchorElement = domSelection?.anchorNode instanceof HTMLElement
      ? domSelection.anchorNode
      : domSelection?.anchorNode?.parentElement;
    const insideInlineCode = Boolean(
      anchorElement?.closest(".markdown-inline-code") && root.contains(anchorElement),
    );
    const insideCodeBlock = Boolean(
      anchorElement?.closest(".markdown-code-block") && root.contains(anchorElement),
    );

    if (inputType.startsWith("delete")) {
      if (range.start === range.end) {
        const direction = /Backward$/.test(inputType) ? "backward" : "forward";
        const structural = direction === "backward"
          ? deleteMarkdownBackwardAtBlockStart(current, range)
          : undefined;
        if (structural) {
          updateSource(() => structural);
          return;
        }
        const granularity = /Word/.test(inputType) ? "word" : /Line/.test(inputType) ? "line" : "grapheme";
        const lineBoundary = granularity === "line" ? visualLineDeletionRange(root, direction) : undefined;
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

    if (inputType === "formatIndent" || inputType === "formatOutdent") {
      updateSource((value) => indentMarkdownListItem(
        value,
        range,
        inputType === "formatIndent" ? "indent" : "outdent",
      ));
      return;
    }

    const paragraphBreak = inputType === "insertParagraph";
    const lineBreak = inputType === "insertLineBreak";
    const insertedText = paragraphBreak ? "\n\n" : lineBreak ? "<br>" : data;
    if (insertedText === undefined) return;
    if ((paragraphBreak || lineBreak || /^[ \t]+$/.test(insertedText)) &&
        range.start === range.end) {
      const outside = whitespaceOffsetOutsideInlineFormat(root, range.start, current);
      if (outside !== undefined) range = { start: outside, end: outside };
    }
    const currentBlocks = current === activeSource ? blocks : parseMarkdownBlocks(current);
    const block = currentBlocks.find((entry) => (
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
    if (!paragraphBreak && !lineBreak && pendingInlineFormatsRef.current.size > 0) {
      const formats = [...pendingInlineFormatsRef.current];
      pendingInlineFormatsRef.current.clear();
      updateSource((value) => insertMarkdownTextWithFormats(value, range, insertedText, formats));
      return;
    }
    updateSource((value) => paragraphBreak
      ? insideCodeBlock
        ? replaceMarkdownRange(value, range, "\n")
        : insertMarkdownParagraphBreak(value, range)
      : lineBreak
        ? replaceMarkdownRange(value, range, insideCodeBlock ? "\n" : insertedText)
        : insideInlineCode || insideCodeBlock
          ? replaceMarkdownRange(value, range, insertedText)
          : replaceMarkdownTextWithInputRules(
          value,
          range,
          insertedText,
          { start: insertedText.length, end: insertedText.length },
          inputType === "insertFromPaste" ? "paste" : "typing",
          ));
  };

  const currentCommandRange = () => {
    const root = rootRef.current;
    const currentSelection = root ? readMarkdownSourceSelection(root, true) : undefined;
    if (currentSelection?.sourceId === sourceId) return currentSelection.range;
    if (root?.contains(document.activeElement) && activeSource.length === 0) {
      return { start: 0, end: 0 };
    }
    return selection?.range;
  };
  const executeCommand = (command: MarkdownCommand, range = currentCommandRange()) => {
    if (!range) return;
    if (range.start === range.end && command.type === "inline-format") {
      const pending = pendingInlineFormatsRef.current;
      if (pending.has(command.format)) pending.delete(command.format);
      else pending.add(command.format);
      return;
    }
    if (range.start === range.end && command.type === "clear-formatting") {
      pendingInlineFormatsRef.current.clear();
      return;
    }
    updateSource((current) => applyMarkdownCommand(current, range, command));
  };
  const applyFormat = (format: MarkdownInlineFormat) => {
    executeCommand({ type: "inline-format", format }, selection?.range);
  };
  const applyLink = () => {
    const range = selection?.range ?? currentCommandRange();
    if (!range) return;
    const href = window.prompt("링크 URL을 입력하세요. 비워두면 링크가 제거됩니다.", "https://");
    if (href !== null) executeCommand({ type: "link", href: href.trim() || undefined }, range);
  };
  const applyBlockquote = () => {
    executeCommand({ type: "blockquote" }, selection?.range);
  };
  const applyQuickInsert = (command: MarkdownCommand) => {
    if (!quickInsertTrigger) return;
    updateSource((current) => applyMarkdownQuickInsertCommand(current, quickInsertTrigger, command));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !rootRef.current?.contains(document.activeElement) ||
        event.isComposing ||
        !(event.metaKey || event.ctrlKey)
      ) return;
      const key = event.key.toLowerCase();
      if (key === "z" || key === "y") {
        event.preventDefault();
        applyHistory(key === "y" || event.shiftKey ? "redo" : "undo");
        return;
      }
      let command: MarkdownCommand | undefined;
      if (!event.shiftKey && key === "b") command = { type: "inline-format", format: "strong" };
      else if (!event.shiftKey && key === "i") command = { type: "inline-format", format: "emphasis" };
      else if (!event.shiftKey && key === "u") command = { type: "inline-format", format: "underline" };
      else if (event.shiftKey && key === "s") command = { type: "inline-format", format: "delete" };
      else if (event.shiftKey && key === "m") command = { type: "inline-format", format: "inline-code" };
      else if (event.shiftKey && key === "7") command = { type: "list", style: "ordered" };
      else if (event.shiftKey && key === "8") command = { type: "list", style: "unordered" };
      else if (event.shiftKey && key === "9") command = { type: "blockquote" };
      else if (event.shiftKey && key === "-") command = { type: "divider" };
      else if (!event.shiftKey && key === "\\") command = { type: "clear-formatting" };
      if (!command && event.shiftKey && key === "k") {
        event.preventDefault();
        applyLink();
        return;
      }
      if (!command) return;
      event.preventDefault();
      executeCommand(command);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const markdownEditing: MarkdownEditingContext = {
    source: activeSource,
    sourceId,
    onEditIntent: editFromInput,
    onCompositionCommit: (initialRange, text) => {
      committedCompositionRef.current = text;
      const queuedSelection = pendingMarkdownSelections.get(sourceId);
      const range = sourceRef.current !== activeSource &&
          queuedSelection?.ownerRenderId === renderId
        ? queuedSelection.range
        : initialRange;
      if (interactionDebugEnabled()) {
        recordInteraction("markdown-input", {
          sourceId,
          inputType: "insertCompositionText",
          dataKind: text === "\n" ? "newline" : text ? "text" : "empty",
          dataLength: text.length,
          initialRange,
          selection: range,
        });
      }
      updateSource((current) => replaceMarkdownTextWithInputRules(
        current,
        range,
        text,
        { start: text.length, end: text.length },
        "typing",
      ));
    },
    consumeCompositionEcho: (inputType, data, isComposing) => {
      const committedComposition = committedCompositionRef.current;
      if (committedComposition === undefined) return false;
      committedCompositionRef.current = undefined;
      return !isComposing &&
        data === committedComposition &&
        ["insertText", "insertCompositionText", "insertFromComposition"].includes(inputType);
    },
    clearCompositionEcho: () => {
      committedCompositionRef.current = undefined;
    },
    onTaskToggle: (itemStart, checked) => updateSource((current) => (
      setMarkdownTaskItemChecked(current, itemStart, checked)
    )),
  };

  return (
    <div
      {...hostProps}
      ref={rootRef}
      tabIndex={-1}
      data-document-edit-target="true"
      data-markdown-edit-source-id={sourceId}
      onMouseDownCapture={(event) => {
        hostProps.onMouseDownCapture?.(event);
        const editable = event.target instanceof Element
          ? event.target.closest<HTMLElement>('[contenteditable="true"]')
          : undefined;
        if (!editable || !event.currentTarget.contains(editable)) {
          event.currentTarget.focus({ preventScroll: true });
        }
      }}
      onFocusCapture={(event) => {
        hostProps.onFocusCapture?.(event);
      }}
      onClick={(event) => {
        hostProps.onClick?.(event);
        const editableSurface = event.target instanceof Element
          ? event.target.closest<HTMLElement>('[contenteditable="true"]')
          : undefined;
        if (!editableSurface || !event.currentTarget.contains(editableSurface)) return;
        onActivateTarget?.(target, renderId, event.nativeEvent);
      }}
      onBlurCapture={(event) => {
        const remainsInsideRoot = event.relatedTarget instanceof Node &&
          event.currentTarget.contains(event.relatedTarget);
        hostProps.onBlurCapture?.(event);
        if (remainsInsideRoot) return;
        bufferedSource.flush();
      }}
    >
      {renderedBlocks.length ? renderedBlocks.map((block) => (
        <MarkdownBlockContent
          key={block.id}
          block={block}
          documentBlocks={blocks}
          context="document"
          idPrefix={`markdown-${sourceId}`}
          editing={markdownEditing}
        />
      )) : (
        <MarkdownEmptyContent editing={markdownEditing} />
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
      {quickInsertOpen && caretSelection && (
        <MarkdownQuickInsertMenu
          rect={caretSelection.rect}
          query={quickInsertTrigger.query}
          onSelect={applyQuickInsert}
          onClose={() => setDismissedQuickInsertAt(quickInsertTrigger.range.start)}
        />
      )}
    </div>
  );
}

function editTargetSourceId(target: DocumentEditTarget): string {
  if (target.kind === "node") return `node-${target.nodeId}`;
  if (target.kind === "component-prop") return `instance-${target.instanceNodeId}-prop-${target.propId}`;
  return `repeater-${target.repeaterNodeId}-item-${target.itemId}-prop-${target.propId}`;
}

function rootContainsMarkdownRange(
  root: HTMLElement,
  sourceId: string,
  range: MarkdownSourceRange,
): boolean {
  const offsets = new Set(
    Array.from(root.querySelectorAll<HTMLElement>("[data-markdown-source-map]"))
      .filter((element) => element.dataset.markdownSourceId === sourceId)
      .flatMap((element) => parseSourceMap(element.dataset.markdownSourceMap)),
  );
  return offsets.has(range.start) && offsets.has(range.end);
}

function markdownBlockContainingRange(
  blocks: ReturnType<typeof parseMarkdownBlocks>,
  range: MarkdownSourceRange,
) {
  return blocks.find((block) => {
    const start = block.node.position?.start.offset;
    const end = block.node.position?.end.offset;
    return start !== undefined && end !== undefined &&
      range.start >= start && range.end <= end;
  });
}

function markdownSourceDebugSummary(source: string, offset: number): Record<string, unknown> {
  const normalizedOffset = Math.max(0, Math.min(source.length, offset));
  const before = source.slice(0, normalizedOffset);
  const lineIndex = before.split("\n").length - 1;
  const lineStart = source.lastIndexOf("\n", Math.max(0, normalizedOffset - 1)) + 1;
  const lineEndCandidate = source.indexOf("\n", normalizedOffset);
  const lineEnd = lineEndCandidate < 0 ? source.length : lineEndCandidate;
  const line = source.slice(lineStart, lineEnd);
  const indentLength = line.match(/^[ \t]*/)?.[0].length ?? 0;
  const kind = /^[ \t]*[-+*][ \t]+\[[ xX]\][ \t]+/.test(line)
    ? "task"
    : /^[ \t]*[-+*][ \t]+/.test(line)
      ? "unordered"
      : /^[ \t]*[0-9]{1,9}[.)][ \t]+/.test(line)
        ? "ordered"
        : /^[ \t]*#{1,6}[ \t]+/.test(line)
          ? "heading"
          : /^[ \t]*>[ \t]+/.test(line)
            ? "blockquote"
            : line.trim().length === 0
              ? "blank"
              : "text";
  return {
    length: source.length,
    lineCount: source.split("\n").length,
    lineIndex,
    lineStart,
    lineEnd,
    indentLength,
    kind,
    blockKinds: parseMarkdownBlocks(source).map((block) => block.node.type),
  };
}
