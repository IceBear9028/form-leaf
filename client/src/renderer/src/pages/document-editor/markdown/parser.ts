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

export type MarkdownTextSegment = {
  text: string;
  sourceStart: number;
  sourceEnd: number;
  sourceBoundaries: number[];
  underline: boolean;
};

const markOrder: MarkdownInlineMark[] = ["strong", "underline", "link"];

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm);

const markdownBlockCache = new Map<string, MarkdownBlock[]>();
const MARKDOWN_BLOCK_CACHE_LIMIT = 128;

export function parseMarkdownTree(source: string): Root {
  const parsed = markdownProcessor.parse(normalizeLineEndings(source));
  const tree = markdownProcessor.runSync(parsed) as Root;
  applySourcePositionedBreaks(tree, normalizeLineEndings(source));
  return tree;
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

export function markdownEditableBlankLineOffsets(
  source: string,
  start: number,
  end: number,
  structuralNewlines: number,
): number[] {
  const gap = source.slice(start, end);
  if (!/^(?:[ \t]*\n)+[ \t]*$/.test(gap)) return [];
  const newlineOffsets = Array.from(gap.matchAll(/\n/g), (match) =>
    start + (match.index ?? 0) + 1,
  );
  return newlineOffsets.slice(0, Math.max(0, newlineOffsets.length - structuralNewlines));
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

export function markdownTextSegments(
  source: string,
  start: number,
  end: number,
  value: string,
): MarkdownTextSegment[] {
  const raw = source.slice(start, end);
  const boundaries = textSourceBoundaries(raw, value).map((offset) => start + offset);
  const segments: MarkdownTextSegment[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    const opening = value.indexOf("++", cursor);
    const closing = opening < 0 ? -1 : value.indexOf("++", opening + 2);
    if (opening < 0 || closing < 0) {
      pushTextSegment(segments, value, boundaries, cursor, value.length, false);
      break;
    }
    pushTextSegment(segments, value, boundaries, cursor, opening, false);
    pushTextSegment(segments, value, boundaries, opening + 2, closing, true);
    cursor = closing + 2;
  }

  return segments;
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

function pushTextSegment(
  segments: MarkdownTextSegment[],
  value: string,
  boundaries: number[],
  start: number,
  end: number,
  underline: boolean,
): void {
  if (end <= start) return;
  const sourceBoundaries = boundaries.slice(start, end + 1);
  segments.push({
    text: value.slice(start, end),
    sourceStart: sourceBoundaries[0] ?? 0,
    sourceEnd: sourceBoundaries.at(-1) ?? sourceBoundaries[0] ?? 0,
    sourceBoundaries,
    underline,
  });
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
