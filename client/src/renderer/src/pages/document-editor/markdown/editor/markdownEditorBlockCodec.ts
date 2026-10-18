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
  const start = block?.node.position?.start.offset;
  const end = block?.node.position?.end.offset;
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
