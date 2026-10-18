import type {
  FootnoteDefinition,
  List,
  PhrasingContent,
  RootContent,
  Table,
} from "mdast";
import {
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  collectMarkdownDefinitions,
  markdownEditableBlankLineOffsets,
  markdownTextSegments,
  parseMarkdownBlocks,
  type MarkdownBlock,
  type MarkdownDefinition,
} from "./parser";
import {
  markdownEmptyListItemCaretOffset,
  type MarkdownSourceRange,
} from "./edits";
import {
  interactionDebugEnabled,
  recordInteraction,
} from "../interactionDebug.ts";

export type MarkdownContext = "document";

type MarkdownRenderContext = {
  definitions: Map<string, MarkdownDefinition>;
  footnoteNumbers: Map<string, number>;
  idPrefix: string;
  editing?: MarkdownEditingContext;
};

export type MarkdownEditingContext = {
  source: string;
  sourceId: string;
  onTextEdit: (
    range: MarkdownSourceRange,
    visibleText: string,
    visibleSelection: MarkdownSourceRange,
  ) => void;
  onEditIntent: (
    root: HTMLElement,
    inputType: string,
    data?: string,
  ) => void;
  onTaskToggle: (itemStart: number, checked: boolean) => void;
};

export function MarkdownContent({
  source,
  context,
  blockIndexes,
  showFootnotes = true,
}: {
  source: string;
  context: MarkdownContext;
  blockIndexes?: number[];
  showFootnotes?: boolean;
}) {
  const generatedId = useId();
  const blocks = parseMarkdownBlocks(source);
  const renderedBlocks = blockIndexes
    ? blockIndexes.flatMap((index) => blocks[index] ? [blocks[index]] : [])
    : blocks;
  const footnotes = getFootnotes(blocks);
  const renderContext = createRenderContext(blocks, `markdown-${generatedId.replaceAll(":", "")}`);

  return (
    <div className={`markdown-body markdown-body--${context}`}>
      {renderedBlocks.map((block) => (
        <MarkdownBlockView
          key={block.id}
          block={block}
          renderContext={renderContext}
        />
      ))}
      {showFootnotes && footnotes.length > 0 && (
        <MarkdownFootnotes footnotes={footnotes} renderContext={renderContext} />
      )}
    </div>
  );
}

export function MarkdownBlockContent({
  block,
  documentBlocks,
  context,
  idPrefix,
  lead = false,
  editing,
}: {
  block: MarkdownBlock;
  documentBlocks: MarkdownBlock[];
  context: MarkdownContext;
  idPrefix: string;
  lead?: boolean;
  editing?: MarkdownEditingContext;
}) {
  const activeEditing = editing && isEditableMarkdownBlock(block.node) ? editing : undefined;
  const rootRef = useMarkdownEditingHost(activeEditing);
  const leadingOffsets = activeEditing
    ? leadingLineOffsets(block, documentBlocks, activeEditing.source)
    : [];
  const previousBlockCapturesGap = editing
    ? previousEditableBlockCapturesGap(block, documentBlocks, editing.source)
    : false;
  const trailingOffsets = activeEditing
    ? trailingLineOffsets(block, documentBlocks, activeEditing.source)
    : [];
  const emptyBlockOffsets = trailingOffsets.filter((_, index) => index % 2 === 1);
  const unpairedTrailingOffsets = trailingOffsets.length % 2 === 1
    ? trailingOffsets.slice(-1)
    : [];

  return (
    <>
      <div
      ref={rootRef}
      className={`markdown-body markdown-body--${context}${activeEditing ? " markdown-editable-block" : ""}`}
      contentEditable={activeEditing ? true : undefined}
      suppressContentEditableWarning={Boolean(activeEditing)}
      spellCheck={activeEditing ? false : undefined}
      role={activeEditing ? "textbox" : undefined}
      aria-multiline={activeEditing ? true : undefined}
      data-markdown-editable-block={activeEditing ? activeEditing.sourceId : undefined}
      onKeyDown={activeEditing
        ? (event) => onMarkdownEditingKeyDown(event, activeEditing)
        : undefined}
    >
      {!previousBlockCapturesGap && leadingOffsets.length > 0 && (
        <div
          className="markdown-extra-blank-lines markdown-edit-leading-lines"
          data-markdown-edit-group={`${activeEditing?.sourceId}:gap:${block.node.position?.start.offset ?? 0}`}
          aria-hidden="true"
        >
          {leadingOffsets.map((offset) => (
            <span key={offset}>
              <span
                className="markdown-caret-anchor"
                data-markdown-source-id={activeEditing?.sourceId}
                data-markdown-source-map={`${offset},${offset}`}
              >{"\u200b"}</span>
            </span>
          ))}
        </div>
      )}
      <MarkdownBlockView
        block={block}
        lead={lead}
        renderContext={createRenderContext(documentBlocks, idPrefix, activeEditing)}
        showExtraBlankLines={!previousBlockCapturesGap && leadingOffsets.length === 0}
      />
      {unpairedTrailingOffsets.length > 0 && (
        <div
          className="markdown-edit-trailing-lines"
          data-markdown-edit-group={`${activeEditing?.sourceId}:${block.node.position?.start.offset ?? 0}`}
          aria-hidden="true"
        >
          {unpairedTrailingOffsets.map((offset) => (
            <span className="markdown-edit-trailing-line" key={offset}>
              <span
                className="markdown-caret-anchor"
                data-markdown-source-id={activeEditing?.sourceId}
                data-markdown-source-map={`${offset},${offset}`}
              >{"\u200b"}</span>
            </span>
          ))}
        </div>
      )}
      </div>
      {activeEditing && emptyBlockOffsets.map((offset) => (
        <MarkdownEmptyBlockContent
          context={context}
          editing={activeEditing}
          offset={offset}
          key={`empty-${offset}`}
        />
      ))}
    </>
  );
}

function MarkdownEmptyBlockContent({
  context,
  editing,
  offset,
}: {
  context: MarkdownContext;
  editing: MarkdownEditingContext;
  offset: number;
}) {
  const rootRef = useMarkdownEditingHost(editing);
  return (
    <div
      ref={rootRef}
      className={`markdown-body markdown-body--${context} markdown-editable-block markdown-empty-block-host`}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      role="textbox"
      aria-multiline
      data-markdown-editable-block={editing.sourceId}
      onKeyDown={(event) => onMarkdownEditingKeyDown(event, editing)}
    >
      <p
        className="markdown-block markdown-paragraph markdown-empty-block"
        data-markdown-block="paragraph"
        data-markdown-edit-group={`${editing.sourceId}:empty:${offset}`}
      >
        <MarkdownCaretAnchor offset={offset} editing={editing} />
      </p>
    </div>
  );
}

function useMarkdownEditingHost(editing?: MarkdownEditingContext) {
  const rootRef = useRef<HTMLDivElement>(null);
  const compositionRef = useRef<{
    element: HTMLElement;
    range: MarkdownSourceRange;
  } | undefined>(undefined);
  const ignoreNextCompositionInputRef = useRef(false);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !editing) return;

    const onBeforeInput = (event: InputEvent) => {
      if (ignoreNextCompositionInputRef.current) {
        ignoreNextCompositionInputRef.current = false;
        event.preventDefault();
        return;
      }
      if (event.isComposing || compositionRef.current) return;
      event.preventDefault();
      editing.onEditIntent(root, event.inputType, event.data ?? undefined);
    };
    const onPaste = (event: ClipboardEvent) => {
      event.preventDefault();
      editing.onEditIntent(
        root,
        "insertFromPaste",
        event.clipboardData?.getData("text/plain") ?? "",
      );
    };
    const onCompositionStart = () => {
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      const range = selection.getRangeAt(0);
      const element = closestSourceSegment(range.startContainer);
      const sourceRange = element ? sourceRangeForSegment(element) : undefined;
      if (element && sourceRange) compositionRef.current = { element, range: sourceRange };
    };
    const onCompositionEnd = () => {
      const composition = compositionRef.current;
      compositionRef.current = undefined;
      if (!composition) return;
      ignoreNextCompositionInputRef.current = true;
      window.setTimeout(() => { ignoreNextCompositionInputRef.current = false; }, 0);
      const rawText = composition.element.textContent ?? "";
      const rawSelection = selectionInside(composition.element);
      const placeholderBeforeStart = rawText.slice(0, rawSelection.start).split("\u200b").length - 1;
      const placeholderBeforeEnd = rawText.slice(0, rawSelection.end).split("\u200b").length - 1;
      if (composition.element.classList.contains("markdown-hard-break-caret")) {
        composition.element.textContent = "\u200b";
      }
      editing.onTextEdit(
        composition.range,
        rawText.replaceAll("\u200b", ""),
        {
          start: rawSelection.start - placeholderBeforeStart,
          end: rawSelection.end - placeholderBeforeEnd,
        },
      );
    };

    root.addEventListener("beforeinput", onBeforeInput);
    root.addEventListener("paste", onPaste);
    root.addEventListener("compositionstart", onCompositionStart);
    root.addEventListener("compositionend", onCompositionEnd);
    return () => {
      root.removeEventListener("beforeinput", onBeforeInput);
      root.removeEventListener("paste", onPaste);
      root.removeEventListener("compositionstart", onCompositionStart);
      root.removeEventListener("compositionend", onCompositionEnd);
    };
  }, [editing]);

  return rootRef;
}

function onMarkdownEditingKeyDown(
  event: ReactKeyboardEvent<HTMLDivElement>,
  editing: MarkdownEditingContext,
) {
  if (interactionDebugEnabled() && [" ", "Tab", "Enter", "Escape"].includes(event.key)) {
    recordInteraction("markdown-key", {
      sourceId: editing.sourceId,
      key: event.key === " " ? "Space" : event.key,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      composing: event.nativeEvent.isComposing,
    });
  }
  if ((event.key === " " || event.code === "Space") &&
      !event.metaKey && !event.ctrlKey && !event.altKey &&
      !event.nativeEvent.isComposing) {
    event.preventDefault();
    editing.onEditIntent(event.currentTarget, "insertText", " ");
    return;
  }
  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
    event.preventDefault();
    editing.onEditIntent(
      event.currentTarget,
      event.shiftKey ? "insertLineBreak" : "insertParagraph",
    );
    return;
  }
  if (event.key === "Tab" && !event.nativeEvent.isComposing) {
    event.preventDefault();
    editing.onEditIntent(
      event.currentTarget,
      event.shiftKey ? "formatOutdent" : "formatIndent",
    );
    return;
  }
  if (event.key === "Escape") window.getSelection()?.removeAllRanges();
}

export function MarkdownFootnotesContent({
  documentBlocks,
  context,
  idPrefix,
}: {
  documentBlocks: MarkdownBlock[];
  context: MarkdownContext;
  idPrefix: string;
}) {
  const footnotes = getFootnotes(documentBlocks);
  if (!footnotes.length) return null;
  const renderContext = createRenderContext(documentBlocks, idPrefix);
  return (
    <div className={`markdown-body markdown-body--${context}`}>
      <MarkdownFootnotes footnotes={footnotes} renderContext={renderContext} />
    </div>
  );
}

export function MarkdownBlockView({
  block,
  lead = false,
  renderContext = emptyRenderContext,
  showExtraBlankLines = true,
}: {
  block: MarkdownBlock;
  lead?: boolean;
  renderContext?: MarkdownRenderContext;
  showExtraBlankLines?: boolean;
}) {
  if (block.node.type === "definition" || block.node.type === "footnoteDefinition") return null;
  return (
    <>
      {showExtraBlankLines && block.extraBlankLinesBefore > 0 && (
        <div className="markdown-extra-blank-lines" aria-hidden="true">
          {Array.from({ length: block.extraBlankLinesBefore }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      )}
      <MarkdownNodeView node={block.node} lead={lead} renderContext={renderContext} />
    </>
  );
}

function MarkdownNodeView({
  node,
  lead = false,
  compact = false,
  renderContext,
}: {
  node: RootContent;
  lead?: boolean;
  compact?: boolean;
  renderContext: MarkdownRenderContext;
}): ReactNode {
  if (node.type === "heading") {
    const HeadingTag = `h${node.depth}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    const emptyOffset = renderContext.editing && node.children.length === 0
      ? emptyHeadingContentOffset(node, renderContext.editing.source)
      : undefined;
    const trailingWhitespace = markdownTrailingWhitespace(node, renderContext, emptyOffset);
    return (
      <HeadingTag
        className={`markdown-block markdown-heading markdown-heading--h${node.depth}`}
        data-markdown-block="heading"
        data-markdown-edit-group={markdownEditGroup(node, renderContext)}
        {...markdownSourceOuter(node, renderContext)}
      >
        <MarkdownInline nodes={node.children} renderContext={renderContext} />
        {emptyOffset !== undefined && (
          <MarkdownCaretAnchor offset={emptyOffset} editing={renderContext.editing!} />
        )}
        {trailingWhitespace}
      </HeadingTag>
    );
  }

  if (node.type === "paragraph") {
    const trailingWhitespace = markdownTrailingWhitespace(node, renderContext);
    return (
      <p
        className={[
          "markdown-block",
          "markdown-paragraph",
          lead ? "markdown-paragraph--lead" : "",
          compact ? "markdown-paragraph--compact" : "",
        ].filter(Boolean).join(" ")}
        data-markdown-block="paragraph"
        data-markdown-edit-group={markdownEditGroup(node, renderContext)}
        {...markdownSourceOuter(node, renderContext)}
      >
        <MarkdownInline nodes={node.children} renderContext={renderContext} />
        {trailingWhitespace}
      </p>
    );
  }

  if (node.type === "list") {
    return <MarkdownList node={node} renderContext={renderContext} />;
  }

  if (node.type === "blockquote") {
    return (
      <blockquote className="markdown-block markdown-blockquote" data-markdown-block="blockquote">
        {node.children.map((child, index) => (
          <MarkdownNodeView
            key={index}
            node={child}
            compact
            renderContext={renderContext}
          />
        ))}
      </blockquote>
    );
  }

  if (node.type === "code") {
    const editing = renderContext.editing;
    const bounds = editing ? markdownCodeContentBounds(node, editing.source) : undefined;
    return (
      <pre
        className="markdown-block markdown-code-block"
        data-markdown-block="code"
        data-markdown-edit-group={markdownEditGroup(node, renderContext)}
        {...markdownSourceOuter(node, renderContext)}
      >
        <code className={node.lang ? `language-${node.lang}` : undefined}>
          {editing && bounds
            ? node.value
              ? (
                  <span
                    className="markdown-editable-segment"
                    data-markdown-source-id={editing.sourceId}
                    data-markdown-source-map={Array.from(
                      { length: node.value.length + 1 },
                      (_, index) => Math.min(bounds.end, bounds.start + index),
                    ).join(",")}
                    data-markdown-source-outer-start={bounds.start}
                    data-markdown-source-outer-end={bounds.end}
                  >{node.value}</span>
                )
              : <MarkdownCaretAnchor offset={bounds.start} editing={editing} />
            : node.value}
        </code>
      </pre>
    );
  }

  if (node.type === "thematicBreak") {
    const emptyFormat = renderContext.editing
      ? emptyBlockFormat(node, renderContext.editing.source)
      : undefined;
    if (emptyFormat) {
      const content = <MarkdownCaretAnchor offset={emptyFormat.offset} editing={renderContext.editing!} />;
      return (
        <p
          className="markdown-block markdown-paragraph"
          data-markdown-block="paragraph"
          data-markdown-edit-group={markdownEditGroup(node, renderContext)}
          {...markdownSourceOuter(node, renderContext)}
        >
          {wrapEmptyFormat(emptyFormat.format, content)}
        </p>
      );
    }
    return <hr className="markdown-block markdown-thematic-break" data-markdown-block="separator" />;
  }

  if (node.type === "table") {
    return <MarkdownTable node={node} renderContext={renderContext} />;
  }

  if (node.type === "html") {
    return (
      <div className="markdown-block markdown-raw-html" data-markdown-block="html">
        {node.value}
      </div>
    );
  }

  if (node.type === "definition" || node.type === "footnoteDefinition") return null;

  if (isPhrasingContent(node)) {
    return (
      <p className="markdown-block markdown-paragraph" data-markdown-block="paragraph">
        <MarkdownInline nodes={[node]} renderContext={renderContext} />
      </p>
    );
  }

  return null;
}

function MarkdownList({
  node,
  renderContext,
}: {
  node: List;
  renderContext: MarkdownRenderContext;
}) {
  const className = [
    "markdown-block",
    "markdown-list",
    node.ordered ? "markdown-list--ordered" : "markdown-list--unordered",
    node.children.some((item) => item.checked !== null && item.checked !== undefined)
      ? "markdown-list--task"
      : "",
  ].filter(Boolean).join(" ");
  const items = node.children.map((item, index) => (
    <li
      key={index}
      className={item.checked !== null && item.checked !== undefined ? "markdown-task-item" : undefined}
    >
      {item.checked !== null && item.checked !== undefined && (
        <input
          className="markdown-task-checkbox"
          type="checkbox"
          checked={item.checked}
          disabled={!renderContext.editing}
          readOnly={!renderContext.editing}
          contentEditable={false}
          tabIndex={renderContext.editing ? 0 : -1}
          aria-label={item.checked ? "작업 완료 해제" : "작업 완료"}
          onChange={renderContext.editing && item.position?.start.offset !== undefined
            ? (event) => renderContext.editing?.onTaskToggle(
                item.position!.start.offset!,
                event.currentTarget.checked,
              )
            : undefined}
        />
      )}
      <div className="markdown-list-item-content">
        {item.children.length === 0 && renderContext.editing &&
          item.position?.start.offset !== undefined &&
          item.position.end.offset !== undefined && (
          <p
            className="markdown-block markdown-paragraph markdown-paragraph--compact markdown-empty-list-item"
            data-markdown-block="paragraph"
            data-markdown-edit-group={`${renderContext.editing.sourceId}:${item.position.start.offset}`}
          >
            <MarkdownCaretAnchor
              offset={markdownEmptyListItemCaretOffset(
                renderContext.editing.source,
                item.position.start.offset,
                item.position.end.offset,
              )}
              editing={renderContext.editing}
            />
          </p>
        )}
        {item.children.map((child, childIndex) => (
          <MarkdownNodeView
            key={childIndex}
            node={child}
            compact
            renderContext={renderContext}
          />
        ))}
      </div>
    </li>
  ));

  if (node.ordered) {
    return (
      <ol className={className} start={node.start ?? undefined} data-markdown-block="list">
        {items}
      </ol>
    );
  }
  return <ul className={className} data-markdown-block="list">{items}</ul>;
}

function MarkdownTable({
  node,
  renderContext,
}: {
  node: Table;
  renderContext: MarkdownRenderContext;
}) {
  const readOnlyContext = { ...renderContext, editing: undefined };
  const [head, ...body] = node.children;
  return (
    <div className="markdown-block markdown-table-wrap" data-markdown-block="table">
      <table className="markdown-table">
        {head && (
          <thead>
            <tr>
              {head.children.map((cell, index) => (
                <th key={index} style={{ textAlign: node.align?.[index] ?? undefined }}>
                  <MarkdownInline nodes={cell.children} renderContext={readOnlyContext} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        {body.length > 0 && (
          <tbody>
            {body.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.children.map((cell, cellIndex) => (
                  <td key={cellIndex} style={{ textAlign: node.align?.[cellIndex] ?? undefined }}>
                    <MarkdownInline nodes={cell.children} renderContext={readOnlyContext} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
}

function MarkdownInline({
  nodes,
  renderContext,
}: {
  nodes: PhrasingContent[];
  renderContext: MarkdownRenderContext;
}) {
  return <>{nodes.map((node, index) => (
    <MarkdownInlineNode
      key={index}
      node={node}
      keyPrefix={index}
      renderContext={renderContext}
      breakOffset={node.type === "break"
        ? nodes[index + 1]?.position?.start.offset ?? nodes[index - 1]?.position?.end.offset
        : undefined}
    />
  ))}</>;
}

function MarkdownInlineNode({
  node,
  keyPrefix,
  renderContext,
  breakOffset,
}: {
  node: PhrasingContent;
  keyPrefix: number;
  renderContext: MarkdownRenderContext;
  breakOffset?: number;
}): ReactNode {
  if (node.type === "text") {
    const editing = renderContext.editing;
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (editing && start !== undefined && end !== undefined) {
      const emptyMarkers = renderTextWithEmptyMarkers(editing, node.value, start, end, keyPrefix);
      if (emptyMarkers) return emptyMarkers;
      return markdownTextSegments(editing.source, start, end, node.value).map((segment, index) => {
        const mappedText = (
          <span
            key={`${keyPrefix}-${index}`}
            className="markdown-editable-segment"
            data-markdown-source-id={editing.sourceId}
            data-markdown-source-map={segment.sourceBoundaries.join(",")}
            data-markdown-source-outer-start={segment.sourceStart}
            data-markdown-source-outer-end={segment.sourceEnd}
          >
            {segment.text}
          </span>
        );
        return segment.underline
          ? <u key={`${keyPrefix}-${index}`}>{mappedText}</u>
          : mappedText;
      });
    }
    return textWithUnderline(node.value, keyPrefix);
  }
  if (node.type === "break") {
    return renderContext.editing && breakOffset !== undefined
      ? (
          <>
            <br />
            <span
              className="markdown-caret-anchor"
              data-markdown-source-id={renderContext.editing.sourceId}
              data-markdown-source-map={`${breakOffset},${breakOffset}`}
            >{"\u200b"}</span>
          </>
        )
      : <br />;
  }
  if (node.type === "strong") {
    return <strong {...markdownSourceOuter(node, renderContext)}><MarkdownInline nodes={node.children} renderContext={renderContext} /></strong>;
  }
  if (node.type === "emphasis") {
    return <em {...markdownSourceOuter(node, renderContext)}><MarkdownInline nodes={node.children} renderContext={renderContext} /></em>;
  }
  if (node.type === "delete") {
    return <del {...markdownSourceOuter(node, renderContext)}><MarkdownInline nodes={node.children} renderContext={renderContext} /></del>;
  }
  if (node.type === "inlineCode") {
    const editing = renderContext.editing;
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (editing && start !== undefined && end !== undefined) {
      const raw = editing.source.slice(start, end);
      const openingLength = raw.match(/^`+/)?.[0].length ?? 1;
      const contentStart = start + openingLength;
      const contentEnd = Math.max(contentStart, end - openingLength);
      const boundaries = Array.from(
        { length: node.value.length + 1 },
        (_, index) => Math.min(contentEnd, contentStart + index),
      );
      return (
        <>
          <code className="markdown-inline-code" {...markdownSourceOuter(node, renderContext)}>
            <span
              className="markdown-editable-segment"
              data-markdown-source-id={editing.sourceId}
              data-markdown-source-map={boundaries.join(",")}
              data-markdown-source-outer-start={start}
              data-markdown-source-outer-end={end}
            >{node.value}</span>
          </code>
          <MarkdownCaretAnchor offset={end} editing={editing} />
        </>
      );
    }
    return <code className="markdown-inline-code">{node.value}</code>;
  }
  if (node.type === "html") {
    if (/^<br\s*\/?>$/i.test(node.value)) {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      return renderContext.editing && start !== undefined && end !== undefined
        ? (
            <>
              <span
                className="markdown-editable-segment markdown-hard-break"
                data-markdown-source-id={renderContext.editing.sourceId}
                data-markdown-source-map={`${start},${end}`}
                data-markdown-source-outer-start={start}
                data-markdown-source-outer-end={end}
              >{"\n"}</span>
              <span
                className="markdown-hard-break-caret"
                data-markdown-source-id={renderContext.editing.sourceId}
                data-markdown-source-map={`${end},${end}`}
              >{"\u200b"}</span>
            </>
          )
        : <br />;
    }
    return <span className="markdown-inline-html" contentEditable={renderContext.editing ? false : undefined} {...markdownSourceOuter(node, renderContext)}>{node.value}</span>;
  }
  if (node.type === "link") {
    return renderLink(node.url, node.title, node.children, renderContext, node.position?.start.offset, node.position?.end.offset);
  }
  if (node.type === "linkReference") {
    const definition = renderContext.definitions.get(normalizeIdentifier(node.identifier));
    return definition
      ? renderLink(definition.url, definition.title, node.children, renderContext, node.position?.start.offset, node.position?.end.offset)
      : <MarkdownInline nodes={node.children} renderContext={renderContext} />;
  }
  if (node.type === "image") return renderImage(node.url, node.alt, node.title);
  if (node.type === "imageReference") {
    const definition = renderContext.definitions.get(normalizeIdentifier(node.identifier));
    return definition
      ? renderImage(definition.url, node.alt, definition.title)
      : <span>{node.alt}</span>;
  }
  if (node.type === "footnoteReference") {
    const identifier = normalizeIdentifier(node.identifier);
    const number = renderContext.footnoteNumbers.get(identifier);
    if (!number) return <sup>[{node.label ?? node.identifier}]</sup>;
    const anchorId = `${renderContext.idPrefix}-footnote-${encodeURIComponent(identifier)}`;
    return <sup className="markdown-footnote-reference"><a href={`#${anchorId}`}>{number}</a></sup>;
  }
  return null;
}

function MarkdownCaretAnchor({
  offset,
  editing,
}: {
  offset: number;
  editing: MarkdownEditingContext;
}) {
  return (
    <span
      className="markdown-caret-anchor"
      data-markdown-source-id={editing.sourceId}
      data-markdown-source-map={`${offset},${offset}`}
    >{"\u200b"}</span>
  );
}

function markdownTrailingWhitespace(
  node: Extract<RootContent, { type: "heading" | "paragraph" }>,
  renderContext: MarkdownRenderContext,
  emptyContentOffset?: number,
): ReactNode {
  const editing = renderContext.editing;
  if (!editing) return null;
  const lastChildEnd = node.children.at(-1)?.position?.end.offset;
  const start = lastChildEnd ?? emptyContentOffset;
  if (start === undefined) return null;
  const newline = editing.source.indexOf("\n", start);
  const end = newline < 0 ? editing.source.length : newline;
  const whitespace = editing.source.slice(start, end);
  if (!/^[ \t]+$/.test(whitespace)) return null;
  return (
    <span
      className="markdown-editable-segment markdown-trailing-whitespace"
      data-markdown-source-id={editing.sourceId}
      data-markdown-source-map={Array.from(
        { length: whitespace.length + 1 },
        (_, index) => start + index,
      ).join(",")}
      data-markdown-source-outer-start={start}
      data-markdown-source-outer-end={end}
    >{whitespace}</span>
  );
}

type EmptyInlineFormat = "strong" | "underline" | "delete";

function renderTextWithEmptyMarkers(
  editing: MarkdownEditingContext,
  value: string,
  start: number,
  end: number,
  keyPrefix: number,
): ReactNode[] | undefined {
  const raw = editing.source.slice(start, end);
  if (raw !== value || !/(\*\*\*\*|\+\+\+\+|~~~~)/.test(raw)) return undefined;
  const parts: ReactNode[] = [];
  const pattern = /(\*\*\*\*|\+\+\+\+|~~~~)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw))) {
    if (match.index > cursor) {
      const text = raw.slice(cursor, match.index);
      parts.push(
        <span
          key={`${keyPrefix}-empty-prefix-${cursor}`}
          className="markdown-editable-segment"
          data-markdown-source-id={editing.sourceId}
          data-markdown-source-map={Array.from({ length: text.length + 1 }, (_, index) => start + cursor + index).join(",")}
          data-markdown-source-outer-start={start + cursor}
          data-markdown-source-outer-end={start + match.index}
        >{text}</span>,
      );
    }
    const format: EmptyInlineFormat = match[0] === "****"
      ? "strong"
      : match[0] === "++++"
        ? "underline"
        : "delete";
    const offset = start + match.index + 2;
    parts.push(
      <span key={`${keyPrefix}-empty-format-${match.index}`}>
        {wrapEmptyFormat(format, <MarkdownCaretAnchor offset={offset} editing={editing} />)}
      </span>,
    );
    cursor = match.index + match[0].length;
  }
  if (cursor < raw.length) {
    const text = raw.slice(cursor);
    parts.push(
      <span
        key={`${keyPrefix}-empty-suffix-${cursor}`}
        className="markdown-editable-segment"
        data-markdown-source-id={editing.sourceId}
        data-markdown-source-map={Array.from({ length: text.length + 1 }, (_, index) => start + cursor + index).join(",")}
        data-markdown-source-outer-start={start + cursor}
        data-markdown-source-outer-end={end}
      >{text}</span>,
    );
  }
  return parts;
}

function wrapEmptyFormat(format: EmptyInlineFormat, content: ReactNode): ReactNode {
  if (format === "strong") return <strong>{content}</strong>;
  if (format === "underline") return <u>{content}</u>;
  return <del>{content}</del>;
}

function emptyBlockFormat(
  node: RootContent,
  source: string,
): { format: EmptyInlineFormat; offset: number } | undefined {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) return undefined;
  const raw = source.slice(start, end).trim();
  const format: EmptyInlineFormat | undefined = raw === "****"
    ? "strong"
    : raw === "++++"
      ? "underline"
      : raw === "~~~~"
        ? "delete"
        : undefined;
  return format ? { format, offset: start + source.slice(start, end).indexOf(raw) + 2 } : undefined;
}

function emptyHeadingContentOffset(node: RootContent, source: string): number | undefined {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) return undefined;
  const raw = source.slice(start, end);
  const marker = raw.match(/^ {0,3}#{1,6}/)?.[0];
  if (!marker) return undefined;
  return start + marker.length + (/^[ \t]/.test(raw.slice(marker.length)) ? 1 : 0);
}

function MarkdownFootnotes({
  footnotes,
  renderContext,
}: {
  footnotes: FootnoteDefinition[];
  renderContext: MarkdownRenderContext;
}) {
  return (
    <section className="markdown-block markdown-footnotes" aria-label="각주">
      <ol>
        {footnotes.map((footnote) => {
          const identifier = normalizeIdentifier(footnote.identifier);
          const anchorId = `${renderContext.idPrefix}-footnote-${encodeURIComponent(identifier)}`;
          return (
            <li key={identifier} id={anchorId}>
              {footnote.children.map((child, index) => (
                <MarkdownNodeView
                  key={index}
                  node={child}
                  compact
                  renderContext={renderContext}
                />
              ))}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function renderLink(
  value: string,
  title: string | null | undefined,
  children: PhrasingContent[],
  renderContext: MarkdownRenderContext,
  sourceStart?: number,
  sourceEnd?: number,
): ReactNode {
  const href = safeHref(value);
  const content = <MarkdownInline nodes={children} renderContext={renderContext} />;
  return href
    ? (
        <a
          href={href}
          title={title ?? undefined}
          onClick={renderContext.editing ? (event) => event.preventDefault() : undefined}
          data-markdown-source-outer-start={renderContext.editing ? sourceStart : undefined}
          data-markdown-source-outer-end={renderContext.editing ? sourceEnd : undefined}
        >
          {content}
        </a>
      )
    : <span>{content}</span>;
}

function renderImage(
  value: string,
  alt: string | null | undefined,
  title: string | null | undefined,
): ReactNode {
  const src = safeImageSrc(value);
  return src
    ? <img className="markdown-image" src={src} alt={alt ?? ""} title={title ?? undefined} />
    : <span className="markdown-image-alt">{alt ?? value}</span>;
}

function textWithUnderline(value: string, keyPrefix: number): ReactNode {
  const parts: ReactNode[] = [];
  let cursor = 0;
  let partIndex = 0;
  while (cursor < value.length) {
    const opening = value.indexOf("++", cursor);
    const closing = opening < 0 ? -1 : value.indexOf("++", opening + 2);
    if (opening < 0 || closing < 0) {
      parts.push(<span key={`${keyPrefix}-${partIndex}`}>{value.slice(cursor)}</span>);
      break;
    }
    if (opening > cursor) {
      parts.push(<span key={`${keyPrefix}-${partIndex}`}>{value.slice(cursor, opening)}</span>);
      partIndex += 1;
    }
    parts.push(<u key={`${keyPrefix}-${partIndex}`}>{value.slice(opening + 2, closing)}</u>);
    partIndex += 1;
    cursor = closing + 2;
  }
  return parts.length ? parts : value;
}

function isPhrasingContent(node: RootContent): node is PhrasingContent {
  return [
    "break",
    "delete",
    "emphasis",
    "footnoteReference",
    "html",
    "image",
    "imageReference",
    "inlineCode",
    "link",
    "linkReference",
    "strong",
    "text",
  ].includes(node.type);
}

function safeHref(value: string): string | undefined {
  const trimmed = value.trim();
  return /^(https?:|mailto:)/i.test(trimmed) ? trimmed : undefined;
}

function safeImageSrc(value: string): string | undefined {
  const trimmed = value.trim();
  return /^(https?:|data:image\/(?:avif|gif|jpeg|png|webp);base64,)/i.test(trimmed)
    ? trimmed
    : undefined;
}

function normalizeIdentifier(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function getFootnotes(blocks: MarkdownBlock[]): FootnoteDefinition[] {
  return blocks
    .map(({ node }) => node)
    .filter((node): node is FootnoteDefinition => node.type === "footnoteDefinition");
}

function createRenderContext(
  blocks: MarkdownBlock[],
  idPrefix: string,
  editing?: MarkdownEditingContext,
): MarkdownRenderContext {
  const footnotes = getFootnotes(blocks);
  return {
    definitions: collectMarkdownDefinitions(blocks),
    footnoteNumbers: new Map(
      footnotes.map((footnote, index) => [normalizeIdentifier(footnote.identifier), index + 1]),
    ),
    idPrefix,
    editing,
  };
}

function markdownEditGroup(
  node: RootContent,
  renderContext: MarkdownRenderContext,
): string | undefined {
  const start = node.position?.start.offset;
  return renderContext.editing && start !== undefined
    ? `${renderContext.editing.sourceId}:${start}`
    : undefined;
}

function markdownSourceOuter(
  node: RootContent | PhrasingContent,
  renderContext: MarkdownRenderContext,
): Record<string, number | undefined> {
  return renderContext.editing
    ? {
        "data-markdown-source-outer-start": node.position?.start.offset,
        "data-markdown-source-outer-end": node.position?.end.offset,
      }
    : {};
}

function hasEditableMarkdownText(node: RootContent | PhrasingContent): boolean {
  if (node.type === "text") return node.value.length > 0;
  if ([
    "code",
    "definition",
    "footnoteDefinition",
    "html",
    "image",
    "imageReference",
    "table",
    "thematicBreak",
  ].includes(node.type)) return false;
  if (node.type === "inlineCode") return node.value.length > 0;
  if (!("children" in node) || !Array.isArray(node.children)) return false;
  return node.children.some((child) =>
    hasEditableMarkdownText(child as RootContent | PhrasingContent),
  );
}

function isEditableMarkdownBlock(node: RootContent): boolean {
  if (hasEditableMarkdownText(node)) return true;
  if (node.type === "heading") return true;
  if (node.type === "code" || node.type === "thematicBreak") return true;
  if (node.type === "list" && node.children.some((item) => item.children.length === 0)) {
    return true;
  }
  return false;
}

function markdownCodeContentBounds(
  node: Extract<RootContent, { type: "code" }>,
  source: string,
): { start: number; end: number } | undefined {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) return undefined;
  const raw = source.slice(start, end);
  const opening = raw.match(/^(?:```+|~~~+)[^\n]*\n/);
  if (!opening) return { start, end };
  const closing = raw.match(/\n(?:```+|~~~+)[ \t]*$/);
  return {
    start: start + opening[0].length,
    end: closing ? end - closing[0].length : end,
  };
}

function selectionInside(element: HTMLElement): MarkdownSourceRange {
  const selection = window.getSelection();
  if (!selection?.rangeCount) {
    const end = element.textContent?.length ?? 0;
    return { start: end, end };
  }
  const range = selection.getRangeAt(0);
  return {
    start: textOffset(element, range.startContainer, range.startOffset),
    end: textOffset(element, range.endContainer, range.endOffset),
  };
}

function closestSourceSegment(node: Node): HTMLElement | undefined {
  return node.nodeType === Node.TEXT_NODE
    ? node.parentElement?.closest<HTMLElement>("[data-markdown-source-map]") ?? undefined
    : node instanceof HTMLElement
      ? node.closest<HTMLElement>("[data-markdown-source-map]") ?? undefined
      : undefined;
}

function sourceRangeForSegment(element: HTMLElement): MarkdownSourceRange | undefined {
  const boundaries = element.dataset.markdownSourceMap?.split(",").map(Number);
  if (!boundaries?.length || boundaries.some((value) => !Number.isFinite(value))) return undefined;
  return { start: boundaries[0], end: boundaries[boundaries.length - 1] };
}

function leadingLineOffsets(
  block: MarkdownBlock,
  blocks: MarkdownBlock[],
  source: string,
): number[] {
  const visible = blocks.filter(({ node }) =>
    node.type !== "definition" && node.type !== "footnoteDefinition",
  );
  const blockIndex = visible.indexOf(block);
  if (blockIndex <= 0) return [];
  const previousEnd = visible[blockIndex - 1].node.position?.end.offset;
  const start = block.node.position?.start.offset;
  if (previousEnd === undefined || start === undefined) return [];
  return markdownEditableBlankLineOffsets(source, previousEnd, start, 2);
}

function trailingLineOffsets(
  block: MarkdownBlock,
  blocks: MarkdownBlock[],
  source: string,
): number[] {
  const visible = blocks.filter(({ node }) =>
    node.type !== "definition" && node.type !== "footnoteDefinition",
  );
  const blockIndex = visible.indexOf(block);
  if (blockIndex < 0) return [];
  const end = block.node.position?.end.offset;
  if (end === undefined) return [];
  const nextStart = visible[blockIndex + 1]?.node.position?.start.offset;
  return markdownEditableBlankLineOffsets(
    source,
    end,
    nextStart ?? source.length,
    nextStart === undefined ? 0 : 2,
  );
}

function previousEditableBlockCapturesGap(
  block: MarkdownBlock,
  blocks: MarkdownBlock[],
  source: string,
): boolean {
  const visible = blocks.filter(({ node }) =>
    node.type !== "definition" && node.type !== "footnoteDefinition",
  );
  const blockIndex = visible.indexOf(block);
  const previous = visible[blockIndex - 1];
  if (!previous || !isEditableMarkdownBlock(previous.node)) return false;
  const previousEnd = previous.node.position?.end.offset;
  const start = block.node.position?.start.offset;
  if (previousEnd === undefined || start === undefined) return false;
  return markdownEditableBlankLineOffsets(source, previousEnd, start, 2).length > 0;
}

function textOffset(root: HTMLElement, node: Node, offset: number): number {
  if (!root.contains(node) && root !== node) return root.textContent?.length ?? 0;
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
}

const emptyRenderContext: MarkdownRenderContext = {
  definitions: new Map(),
  footnoteNumbers: new Map(),
  idPrefix: "markdown",
};
