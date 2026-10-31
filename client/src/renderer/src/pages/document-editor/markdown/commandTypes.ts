export type MarkdownInlineFormat =
  | "strong"
  | "emphasis"
  | "underline"
  | "delete"
  | "inline-code";

export type MarkdownCommand =
  | { type: "inline-format"; format: MarkdownInlineFormat }
  | { type: "link"; href?: string }
  | { type: "blockquote" }
  | { type: "list"; style: "unordered" | "ordered" | "task" }
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6 }
  | { type: "paragraph" }
  | { type: "code-block" }
  | { type: "divider" }
  | { type: "clear-formatting" };

