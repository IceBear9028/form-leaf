import { useMemo } from "react";
import type { DocumentData } from "../../../../../foundation/documentModel.ts";
import { NodeRenderer } from "./NodeRenderer.tsx";
import { buildRenderTree } from "./renderTree.ts";
import "./document.css";

export function DocumentRenderer({
  document,
  mode = "screen",
  className,
}: {
  document: DocumentData;
  mode?: "screen" | "measure" | "print";
  className?: string;
}) {
  const tree = useMemo(() => buildRenderTree(document), [document]);
  return (
    <div
      className={["document-renderer", `document-renderer--${mode}`, className].filter(Boolean).join(" ")}
      data-document-render-mode={mode}
    >
      <NodeRenderer node={tree} measure={mode === "measure"} />
    </div>
  );
}
