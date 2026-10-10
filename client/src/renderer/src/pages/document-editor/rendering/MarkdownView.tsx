import { MarkdownContent } from "../markdown/MarkdownContent.tsx";

export function MarkdownView({ source }: { source: string }) {
  return <MarkdownContent source={source} context="document" />;
}
