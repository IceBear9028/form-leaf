import type { ContentBlock, TextContent, TextMark, TextRun } from "./legacyTypes.ts";

export function textContentToMarkdown(content: TextContent): string {
  return content.runs.map(serializeRun).join("");
}

export function contentBlocksToMarkdown(blocks: ContentBlock[]): string {
  return blocks
    .map(contentBlockToMarkdown)
    .filter((value) => value.length > 0)
    .join("\n\n");
}

function contentBlockToMarkdown(block: ContentBlock): string {
  if (block.type === "paragraph") return textContentToMarkdown(block.content);
  if (block.type === "bullet-list") return serializeList(block.items);
  if (block.type === "detail") {
    return [
      hasText(block.title) ? `### ${textContentToMarkdown(block.title)}` : "",
      hasText(block.context) ? serializeBlockquote(block.context) : "",
      serializeList([...block.actions, block.result].filter(hasText)),
    ].filter(Boolean).join("\n\n");
  }
  if (block.type === "link-list") {
    return block.links
      .filter((link) => link.label || link.href)
      .map((link) => `- [${escapeMarkdownText(link.label || link.href)}](${escapeLinkDestination(link.href)})`)
      .join("\n");
  }
  if (!block.items.length) return "";
  return `**기술 스택:** ${escapeMarkdownText(block.items.join(", "))}`;
}

function serializeBlockquote(content: TextContent): string {
  return textContentToMarkdown(content)
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function serializeList(items: TextContent[]): string {
  return items
    .filter(hasText)
    .map((item) => {
      const lines = textContentToMarkdown(item).split("\n");
      return [`- ${lines[0]}`, ...lines.slice(1).map((line) => `  ${line}`)].join("\n");
    })
    .join("\n");
}

function hasText(content: TextContent): boolean {
  return content.runs.some((run) => run.text.length > 0);
}

function serializeRun(run: TextRun): string {
  let value = escapeMarkdownText(run.text);
  if (run.marks?.includes("underline")) value = `++${value}++`;
  if (run.marks?.includes("strong")) value = `**${value}**`;
  if (run.marks?.includes("link") && run.href) {
    value = `[${value}](${escapeLinkDestination(run.href)})`;
  }
  return value;
}

function escapeMarkdownText(value: string): string {
  return value.replace(/[\\`*_[\]{}<>#+\-|~]/g, "\\$&");
}

function escapeLinkDestination(value: string): string {
  return value.replace(/[\\()]/g, "\\$&");
}
