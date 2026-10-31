import { parseMarkdownBlocks } from "../parser.ts";

export type MarkdownEditorBlockSlice = {
  source: string;
  blockIndex: number;
  range: { start: number; end: number };
  markdown: string;
};

export type MarkdownEditorBlockReplacement =
  | {
    type: "applied";
    source: string;
    slice: MarkdownEditorBlockSlice;
  }
  | {
    type: "conflict";
    currentSource: string;
  };

export function createMarkdownEditorBlockSlice(
  source: string,
  blockIndex: number,
): MarkdownEditorBlockSlice | undefined {
  const block = parseMarkdownBlocks(source)[blockIndex];
  const start = originalSourceOffset(source, block?.node.position?.start.offset);
  const end = originalSourceOffset(source, block?.node.position?.end.offset);
  if (start === undefined || end === undefined) {
    if (source.length === 0 && blockIndex === 0) {
      return {
        source,
        blockIndex,
        range: { start: 0, end: 0 },
        markdown: "",
      };
    }
    return undefined;
  }
  return {
    source,
    blockIndex,
    range: { start, end },
    markdown: source.slice(start, end),
  };
}

export function replaceMarkdownEditorBlock(
  currentSource: string,
  slice: MarkdownEditorBlockSlice,
  editorMarkdown: string,
): MarkdownEditorBlockReplacement {
  if (currentSource !== slice.source) {
    return { type: "conflict", currentSource };
  }
  const source = `${currentSource.slice(0, slice.range.start)}${editorMarkdown}${currentSource.slice(slice.range.end)}`;
  return {
    type: "applied",
    source,
    slice: {
      source,
      blockIndex: slice.blockIndex,
      range: {
        start: slice.range.start,
        end: slice.range.start + editorMarkdown.length,
      },
      markdown: editorMarkdown,
    },
  };
}

// remark positions use normalized LF input; replacement ranges address the exact
// canonical source, including untouched CRLF bytes outside the active block.
function originalSourceOffset(source: string, normalizedOffset: number | undefined): number | undefined {
  if (normalizedOffset === undefined) return undefined;
  let offset = 0;
  for (let normalized = 0; normalized < normalizedOffset && offset < source.length; normalized += 1) {
    offset += source[offset] === "\r" && source[offset + 1] === "\n" ? 2 : 1;
  }
  return offset;
}
