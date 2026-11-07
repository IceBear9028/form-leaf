import type {
  Definition,
  PhrasingContent,
  Root,
  RootContent,
} from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
export type MarkdownInlineMark = "strong" | "underline" | "link";

export type MarkdownInlineRun = {
  text: string;
  marks?: MarkdownInlineMark[];
  href?: string;
};

export type MarkdownInlineValue = {
  runs: MarkdownInlineRun[];
};

export type MarkdownBlock = {
  id: string;
  node: RootContent;
  extraBlankLinesBefore: number;
};

export type MarkdownDefinition = Pick<Definition, "url" | "title">;

const markOrder: MarkdownInlineMark[] = ["strong", "underline", "link"];

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm);
const emptyListItemPlaceholder = "\u200b";

const markdownBlockCache = new Map<string, MarkdownBlock[]>();
const MARKDOWN_BLOCK_CACHE_LIMIT = 128;

export function parseMarkdownTree(source: string): Root {
  const normalizedSource = normalizeLineEndings(source);
  const prepared = prepareEmptyListItems(normalizedSource);
  const parsed = markdownProcessor.parse(prepared.source);
  const tree = markdownProcessor.runSync(parsed) as Root;
  if (prepared.insertedOffsets.length > 0) {
    restoreEmptyListItems(tree, normalizedSource, prepared.insertedOffsets);
  }
  applySourcePositionedBreaks(tree, normalizedSource);
  return tree;
}

function prepareEmptyListItems(source: string): {
  source: string;
  insertedOffsets: number[];
} {
  const insertedOffsets: number[] = [];
  const prepared = source.replace(
    /^[ \t]*(?:[-+*]|[0-9]{1,9}[.)])[ \t]+$/gm,
    (line, originalOffset: number) => {
      insertedOffsets.push(originalOffset + line.length + insertedOffsets.length);
      return `${line}${emptyListItemPlaceholder}`;
    },
  );
  return { source: prepared, insertedOffsets };
}

function restoreEmptyListItems(
  tree: Root,
  source: string,
  insertedOffsets: number[],
) {
  const lineStarts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") lineStarts.push(index + 1);
  }

  visitMarkdownNodes(tree as unknown as MutableMarkdownNode, (node) => {
    if (node.position) {
      remapMarkdownPoint(node.position.start, insertedOffsets, lineStarts);
      remapMarkdownPoint(node.position.end, insertedOffsets, lineStarts);
    }
    if (
      node.type === "listItem" && node.children?.length === 1 &&
      node.children[0]?.type === "paragraph" &&
      node.children[0].children?.length === 1 &&
      node.children[0].children[0]?.type === "text" &&
      node.children[0].children[0].value === emptyListItemPlaceholder
    ) {
      node.children = [];
    }
  });
}

function visitMarkdownNodes(
  node: MutableMarkdownNode,
  visit: (node: MutableMarkdownNode) => void,
) {
  visit(node);
  node.children?.forEach((child) => visitMarkdownNodes(child, visit));
}

function remapMarkdownPoint(
  point: { line: number; column: number; offset?: number },
  insertedOffsets: number[],
  lineStarts: number[],
) {
  if (point.offset === undefined) return;
  const removedBefore = insertedOffsets.filter((offset) => offset < point.offset!).length;
  const offset = point.offset - removedBefore;
  let low = 0;
  let high = lineStarts.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (lineStarts[middle] <= offset) low = middle + 1;
    else high = middle;
  }
  const lineIndex = Math.max(0, low - 1);
  point.offset = offset;
  point.line = lineIndex + 1;
  point.column = offset - lineStarts[lineIndex] + 1;
}

export function parseMarkdownBlocks(source: string): MarkdownBlock[] {
  const cached = markdownBlockCache.get(source);
  if (cached) {
    markdownBlockCache.delete(source);
    markdownBlockCache.set(source, cached);
    return cached;
  }
  const children = parseMarkdownTree(source).children;
  const blocks = children.map((node, index) => {
    const previous = children[index - 1];
    const linesBetween = previous?.position?.end.line && node.position?.start.line
      ? node.position.start.line - previous.position.end.line - 1
      : 0;
    return {
      id: `markdown-${node.position?.start.offset ?? index}`,
      node,
      extraBlankLinesBefore: Math.max(0, linesBetween - 1),
    };
  });
  markdownBlockCache.set(source, blocks);
  if (markdownBlockCache.size > MARKDOWN_BLOCK_CACHE_LIMIT) {
    const oldest = markdownBlockCache.keys().next().value;
    if (oldest !== undefined) markdownBlockCache.delete(oldest);
  }
  return blocks;
}

export function clearMarkdownBlockCache(): void {
  markdownBlockCache.clear();
}

export function collectMarkdownDefinitions(
  blocks: MarkdownBlock[],
): Map<string, MarkdownDefinition> {
  const definitions = new Map<string, MarkdownDefinition>();
  blocks.forEach(({ node }) => {
    if (node.type !== "definition") return;
    definitions.set(normalizeIdentifier(node.identifier), {
      url: node.url,
      title: node.title,
    });
  });
  return definitions;
}

export function parseMarkdownInline(source: string): MarkdownInlineValue {
  const tree = parseMarkdownTree(source);
  const definitions = collectMarkdownDefinitions(
    tree.children.map((node, index) => ({
      id: `inline-${index}`,
      node,
      extraBlankLinesBefore: 0,
    })),
  );
  const runs: MarkdownInlineRun[] = [];

  tree.children.forEach((node, index) => {
    if (index > 0 && node.type !== "definition") appendRun(runs, "\n", []);
    if ("children" in node && Array.isArray(node.children)) {
      appendInlineNodes(
        runs,
        node.children.filter(isPhrasingContent),
        [],
        definitions,
      );
      return;
    }
    if (node.type === "code" || node.type === "html") appendRun(runs, node.value, []);
  });

  return { runs: runs.length ? runs : [{ text: "" }] };
}

function appendInlineNodes(
  runs: MarkdownInlineRun[],
  nodes: PhrasingContent[],
  marks: MarkdownInlineMark[],
  definitions: Map<string, MarkdownDefinition>,
  href?: string,
): void {
  nodes.forEach((node) => {
    if (node.type === "text") {
      appendTextWithUnderline(runs, node.value, marks, href);
      return;
    }
    if (node.type === "break") {
      appendRun(runs, "\n", marks, href);
      return;
    }
    if (node.type === "strong") {
      appendInlineNodes(runs, node.children, addMark(marks, "strong"), definitions, href);
      return;
    }
    if (node.type === "link") {
      appendInlineNodes(runs, node.children, addMark(marks, "link"), definitions, node.url);
      return;
    }
    if (node.type === "linkReference") {
      const definition = definitions.get(normalizeIdentifier(node.identifier));
      appendInlineNodes(
        runs,
        node.children,
        definition ? addMark(marks, "link") : marks,
        definitions,
        definition?.url ?? href,
      );
      return;
    }
    if (node.type === "image") {
      appendRun(runs, node.alt ?? "", marks, href);
      return;
    }
    if (node.type === "imageReference") {
      appendRun(runs, node.alt ?? "", marks, href);
      return;
    }
    if (node.type === "inlineCode" || node.type === "html") {
      appendRun(runs, node.value, marks, href);
      return;
    }
    if (node.type === "footnoteReference") {
      appendRun(runs, `[^${node.label ?? node.identifier}]`, marks, href);
      return;
    }
    appendInlineNodes(runs, node.children, marks, definitions, href);
  });
}

function appendTextWithUnderline(
  runs: MarkdownInlineRun[],
  value: string,
  marks: MarkdownInlineMark[],
  href?: string,
): void {
  let cursor = 0;
  while (cursor < value.length) {
    const opening = value.indexOf("++", cursor);
    if (opening < 0) {
      appendRun(runs, value.slice(cursor), marks, href);
      return;
    }
    const closing = value.indexOf("++", opening + 2);
    if (closing < 0) {
      appendRun(runs, value.slice(cursor), marks, href);
      return;
    }
    appendRun(runs, value.slice(cursor, opening), marks, href);
    appendRun(runs, value.slice(opening + 2, closing), addMark(marks, "underline"), href);
    cursor = closing + 2;
  }
}

function addMark(marks: MarkdownInlineMark[], mark: MarkdownInlineMark): MarkdownInlineMark[] {
  return markOrder.filter((candidate) => candidate === mark || marks.includes(candidate));
}

function appendRun(runs: MarkdownInlineRun[], text: string, marks: MarkdownInlineMark[], href?: string): void {
  if (!text) return;
  const normalizedMarks = markOrder.filter((mark) => marks.includes(mark));
  const previous = runs.at(-1);
  const markKey = normalizedMarks.join(",");
  const previousMarkKey = previous?.marks?.join(",") ?? "";
  if (previous && previousMarkKey === markKey && previous.href === href) {
    previous.text += text;
    return;
  }
  const run: MarkdownInlineRun = { text };
  if (normalizedMarks.length) run.marks = normalizedMarks;
  if (normalizedMarks.includes("link") && href) run.href = href;
  runs.push(run);
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

function normalizeIdentifier(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeLineEndings(value: string): string {
  return value.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

function textSourceBoundaries(raw: string, value: string): number[] {
  const boundaries = [0];
  let rawOffset = 0;
  let valueOffset = 0;

  while (valueOffset < value.length) {
    const character = value[valueOffset];
    if (raw[rawOffset] === "\\" && raw[rawOffset + 1] === character) rawOffset += 1;
    if (raw[rawOffset] === character) {
      rawOffset += 1;
      valueOffset += 1;
      boundaries.push(rawOffset);
      continue;
    }
    const entity = raw.slice(rawOffset).match(/^&(amp|lt|gt|quot|apos);/);
    const decoded = entity ? decodeEntity(entity[1]) : undefined;
    if (entity && decoded === character) {
      rawOffset += entity[0].length;
      valueOffset += 1;
      boundaries.push(rawOffset);
      continue;
    }
    const next = raw.indexOf(character, rawOffset);
    rawOffset = next >= 0 ? next + 1 : Math.min(raw.length, rawOffset + 1);
    valueOffset += 1;
    boundaries.push(rawOffset);
  }

  boundaries[boundaries.length - 1] = raw.length;
  return boundaries;
}

function decodeEntity(name: string): string {
  if (name === "amp") return "&";
  if (name === "lt") return "<";
  if (name === "gt") return ">";
  if (name === "quot") return '"';
  return "'";
}

type MutableMarkdownNode = {
  type: string;
  value?: string;
  position?: {
    start: { line: number; column: number; offset?: number };
    end: { line: number; column: number; offset?: number };
  };
  children?: MutableMarkdownNode[];
  [key: string]: unknown;
};

function applySourcePositionedBreaks(tree: Root, source: string): void {
  splitTextBreaks(tree as unknown as MutableMarkdownNode, source);
}

function splitTextBreaks(node: MutableMarkdownNode, source: string): void {
  if (!node.children) return;
  node.children = node.children.flatMap((child) => {
    if (
      child.type !== "text" ||
      !child.value?.includes("\n") ||
      child.position?.start.offset === undefined ||
      child.position.end.offset === undefined
    ) {
      splitTextBreaks(child, source);
      return child;
    }

    const startOffset = child.position.start.offset;
    const boundaries = textSourceBoundaries(
      source.slice(startOffset, child.position.end.offset),
      child.value,
    ).map((offset) => startOffset + offset);
    const result: MutableMarkdownNode[] = [];
    let partStart = 0;
    for (let index = 0; index < child.value.length; index += 1) {
      if (child.value[index] !== "\n") continue;
      if (index > partStart) {
        result.push({
          ...child,
          value: child.value.slice(partStart, index),
          position: sourcePosition(source, boundaries[partStart], boundaries[index]),
        });
      }
      result.push({
        type: "break",
        position: sourcePosition(source, boundaries[index], boundaries[index + 1]),
      });
      partStart = index + 1;
    }
    if (partStart < child.value.length) {
      result.push({
        ...child,
        value: child.value.slice(partStart),
        position: sourcePosition(
          source,
          boundaries[partStart],
          boundaries[child.value.length],
        ),
      });
    }
    return result;
  });
}

function sourcePosition(source: string, start: number, end: number) {
  return {
    start: sourcePoint(source, start),
    end: sourcePoint(source, end),
  };
}

function sourcePoint(source: string, offset: number) {
  const before = source.slice(0, offset);
  const lastBreak = before.lastIndexOf("\n");
  return {
    line: before.split("\n").length,
    column: offset - lastBreak,
    offset,
  };
}
