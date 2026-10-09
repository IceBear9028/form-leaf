import { useMemo } from "react";
import type { DocumentData } from "../../../../../foundation/documentModel.ts";
import { NodeRenderer } from "./NodeRenderer.tsx";
import type { RenderSelectionTarget } from "./NodeRenderer.tsx";
import { buildRenderTree } from "./renderTree.ts";
import "./document.css";

export function DocumentRenderer({
  document,
  mode = "screen",
  className,
  selectedNodeId,
  selectableNodeIds,
  onSelect,
}: {
  document: DocumentData;
  mode?: "screen" | "measure" | "print";
  className?: string;
  selectedNodeId?: string;
  selectableNodeIds?: ReadonlySet<string>;
  onSelect?: (target: RenderSelectionTarget) => void;
}) {
  const tree = useMemo(() => buildRenderTree(document), [document]);
  return (
    <div
      className={["document-renderer", `document-renderer--${mode}`, className].filter(Boolean).join(" ")}
      data-document-render-mode={mode}
    >
      <NodeRenderer
        node={tree}
        measure={mode === "measure"}
        selectedNodeId={selectedNodeId}
        selectableNodeIds={selectableNodeIds}
        onSelect={onSelect}
      />
    </div>
  );
}
