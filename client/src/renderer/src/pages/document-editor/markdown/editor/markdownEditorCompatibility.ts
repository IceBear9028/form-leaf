import { parseMarkdownBlocks, parseMarkdownTree } from "../parser.ts";

const supportedMarkdownNodeTypes = new Set([
  "root",
  "paragraph",
  "heading",
  "text",
  "emphasis",
  "strong",
  "delete",
  "inlineCode",
  "code",
  "blockquote",
  "list",
  "listItem",
  "thematicBreak",
  "break",
  "link",
]);

type MarkdownTreeNode = {
  type: string;
  value?: string;
  position?: {
    start: { offset?: number };
    end: { offset?: number };
  };
  children?: MarkdownTreeNode[];
};

export type MarkdownEditorCompatibility = {
  editable: boolean;
  unsupportedTypes: string[];
};

export function inspectMarkdownEditorCompatibility(source: string, blockIndex?: number): MarkdownEditorCompatibility {
  const unsupportedTypes = new Set<string>();
  const tree = blockIndex === undefined ? parseMarkdownTree(source) : parseMarkdownBlocks(source)[blockIndex]?.node;
  if (!tree) return { editable: source.length === 0, unsupportedTypes: [] };
  visitMarkdownTree(tree as unknown as MarkdownTreeNode, (node) => {
    if (supportedMarkdownNodeTypes.has(node.type)) return;
    if (node.type === "html" && isMarkdownBreakHtml(node.value)) return;
    unsupportedTypes.add(node.type);
  });
  return {
    editable: unsupportedTypes.size === 0,
    unsupportedTypes: [...unsupportedTypes].sort(),
  };
}

export function prepareMarkdownForEditor(source: string): string {
  const replacements: Array<{ start: number; end: number }> = [];
  visitMarkdownTree(parseMarkdownTree(source) as unknown as MarkdownTreeNode, (node) => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (
      node.type === "html" &&
      isMarkdownBreakHtml(node.value) &&
      start !== undefined &&
      end !== undefined
    ) {
      replacements.push({ start, end });
    }
  });
  return replacements
    .sort((left, right) => right.start - left.start)
    .reduce((current, replacement) => (
      `${current.slice(0, replacement.start)}  \n${current.slice(replacement.end)}`
    ), source);
}

function visitMarkdownTree(node: MarkdownTreeNode, visit: (node: MarkdownTreeNode) => void): void {
  visit(node);
  node.children?.forEach((child) => visitMarkdownTree(child, visit));
}

function isMarkdownBreakHtml(value: string | undefined): boolean {
  return /^<br\s*\/?>$/i.test(value?.trim() ?? "");
}
