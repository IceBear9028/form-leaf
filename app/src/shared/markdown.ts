import type {
  Definition,
  PhrasingContent,
  Root,
  RootContent,
} from "mdast";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { TextContent, TextMark, TextRun } from "./resume";

export {
  contentBlocksToMarkdown,
  textContentToMarkdown,
} from "./markdownSerialization.ts";

export type ResumeMarkdownBlock = {
  id: string;
  node: RootContent;
  extraBlankLinesBefore: number;
};

export type ResumeMarkdownDefinition = Pick<Definition, "url" | "title">;

const markOrder: TextMark[] = ["strong", "underline", "link"];

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkBreaks);

export function parseResumeMarkdownTree(source: string): Root {
  const parsed = markdownProcessor.parse(normalizeLineEndings(source));
  return markdownProcessor.runSync(parsed) as Root;
}

export function parseResumeMarkdown(source: string): ResumeMarkdownBlock[] {
  const children = parseResumeMarkdownTree(source).children;
  return children.map((node, index) => {
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
}

export function collectMarkdownDefinitions(
  blocks: ResumeMarkdownBlock[],
): Map<string, ResumeMarkdownDefinition> {
  const definitions = new Map<string, ResumeMarkdownDefinition>();
  blocks.forEach(({ node }) => {
    if (node.type !== "definition") return;
    definitions.set(normalizeIdentifier(node.identifier), {
      url: node.url,
      title: node.title,
    });
  });
  return definitions;
}

export function parseMarkdownInline(source: string): TextContent {
  const tree = parseResumeMarkdownTree(source);
  const definitions = collectMarkdownDefinitions(
    tree.children.map((node, index) => ({
      id: `inline-${index}`,
      node,
      extraBlankLinesBefore: 0,
    })),
  );
  const runs: TextRun[] = [];

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
  runs: TextRun[],
  nodes: PhrasingContent[],
  marks: TextMark[],
  definitions: Map<string, ResumeMarkdownDefinition>,
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
  runs: TextRun[],
  value: string,
  marks: TextMark[],
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

function addMark(marks: TextMark[], mark: TextMark): TextMark[] {
  return markOrder.filter((candidate) => candidate === mark || marks.includes(candidate));
}

function appendRun(runs: TextRun[], text: string, marks: TextMark[], href?: string): void {
  if (!text) return;
  const normalizedMarks = markOrder.filter((mark) => marks.includes(mark));
  const previous = runs.at(-1);
  const markKey = normalizedMarks.join(",");
  const previousMarkKey = previous?.marks?.join(",") ?? "";
  if (previous && previousMarkKey === markKey && previous.href === href) {
    previous.text += text;
    return;
  }
  const run: TextRun = { text };
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
