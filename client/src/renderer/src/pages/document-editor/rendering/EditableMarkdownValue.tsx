import { useRef, useState, type HTMLAttributes, type MouseEvent } from "react";
import { documentEditTargetKey, type DocumentEditTarget, type TextRange } from "../../../../../foundation/documentEditing.ts";
import { parseMarkdownBlocks } from "../markdown/parser.ts";
import { MarkdownBlockContent, MarkdownFootnotesContent, MarkdownContent } from "../markdown/MarkdownContent.tsx";
import { MarkdownEditorHost, type MarkdownEditorActivation } from "../markdown/editor/MarkdownEditorHost.tsx";
import { inspectMarkdownEditorCompatibility } from "../markdown/editor/markdownEditorCompatibility.ts";
import { beginMarkdownBlock, endMarkdownEditing, publishMarkdownBlock, readPinnedMarkdownBlock } from "../markdown/editor/markdownEditorLifecycle.ts";
import type { RenderMarkdownNode } from "./renderTree.ts";

export function EditableMarkdownValue({ hostProps, target, renderId, source, fragment, onActivateTarget, onChange }: {
  hostProps: HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string | undefined>;
  target: DocumentEditTarget;
  renderId: string;
  source: string;
  fragment?: RenderMarkdownNode["fragment"];
  onActivateTarget?: (target: DocumentEditTarget, renderId: string, event?: Event) => void;
  onChange: (target: DocumentEditTarget, value: string, selection: TextRange) => void;
}) {
  const [active, setActive] = useState<{ blockIndex: number; activation: MarkdownEditorActivation }>();
  const publishRef = useRef(onChange);
  publishRef.current = onChange;
  const blocks = parseMarkdownBlocks(source);
  const indexes = fragment?.blockIndexes ?? (blocks.length ? blocks.map((_, index) => index) : [0]);
  const sourceId = documentEditTargetKey(target);

  const activate = (event: MouseEvent<HTMLDivElement>, blockIndex: number) => {
    if (event.target instanceof Element && event.target.closest('[data-markdown-editor-host]')) return;
    event.preventDefault();
    event.stopPropagation();
    const textOffset = previewTextOffset(event.currentTarget, event.clientX, event.clientY);
    const compatibility = inspectMarkdownEditorCompatibility(source, blockIndex);
    if (!compatibility.editable) {
      endMarkdownEditing();
      onActivateTarget?.(target, renderId, event.nativeEvent);
      return;
    }
    const block = beginMarkdownBlock(target, source, blockIndex);
    if (!block) return;
    let slice = block.slice;
    const activation: MarkdownEditorActivation = {
      markdown: slice.markdown,
      textOffset,
      onSnapshot: (snapshot) => {
        const result = publishMarkdownBlock(slice, block.original, snapshot.markdown);
        if (result.type !== "applied") return;
        slice = result.slice;
        publishRef.current(target, result.source, { start: slice.range.start, end: slice.range.end });
      },
      onClose: () => setActive((current) => current?.activation === activation ? undefined : current),
    };
    setActive({ blockIndex, activation });
    onActivateTarget?.(target, renderId, event.nativeEvent);
  };

  return <div {...hostProps} tabIndex={-1} data-document-edit-target="true" data-markdown-edit-source-id={sourceId}
    onMouseDown={(event) => event.stopPropagation()} onClick={(event) => {
      if (event.target instanceof Element && event.target.closest("a")) event.preventDefault();
      event.stopPropagation();
    }}>
    {indexes.map((blockIndex) => {
      const block = blocks[blockIndex];
      const preview = readPinnedMarkdownBlock(sourceId, blockIndex);
      const editable = inspectMarkdownEditorCompatibility(source, blockIndex).editable;
      return <div key={blockIndex} data-markdown-preview-block={blockIndex} data-markdown-readonly={editable ? undefined : "true"}
        title={editable ? undefined : "이 블록은 원문 보존을 위해 읽기 전용입니다."}
        onMouseDown={(event) => activate(event, blockIndex)}>
        {active?.blockIndex === blockIndex
          ? <MarkdownEditorHost activation={active.activation} />
          : preview !== undefined ? <MarkdownContent source={preview} context="document" />
          : block ? <MarkdownBlockContent block={block} documentBlocks={blocks} context="document" idPrefix={`markdown-${sourceId}`} />
          : <div className="document-empty-editable" data-placeholder="텍스트 입력" aria-label="Markdown 입력" />}
      </div>;
    })}
    {(!fragment || fragment.last) && <MarkdownFootnotesContent documentBlocks={blocks} context="document" idPrefix={`markdown-${sourceId}`} />}
  </div>;
}

function previewTextOffset(root: HTMLElement, x: number, y: number): number {
  const caret = document.caretRangeFromPoint(x, y);
  if (!caret || !root.contains(caret.startContainer)) return root.textContent?.length ?? 0;
  const before = document.createRange();
  before.selectNodeContents(root);
  before.setEnd(caret.startContainer, caret.startOffset);
  const content = before.cloneContents();
  return (content.textContent?.replaceAll("\u200b", "").length ?? 0) + content.querySelectorAll("br").length;
}
