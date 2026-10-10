import { MarkdownContent } from "../markdown/MarkdownContent.tsx";
import type { RenderMarkdownNode } from "./renderTree.ts";

export function MarkdownView({
  source,
  fragment,
}: Pick<RenderMarkdownNode, "source" | "fragment">) {
  return (
    <MarkdownContent
      source={source}
      context="document"
      blockIndexes={fragment?.blockIndexes}
      showFootnotes={fragment?.last ?? true}
    />
  );
}
