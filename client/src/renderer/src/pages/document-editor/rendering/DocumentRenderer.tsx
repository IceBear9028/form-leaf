import { useMemo } from "react";
import type { DocumentData } from "../../../../../foundation/documentModel.ts";
import { NodeRenderer } from "./NodeRenderer.tsx";
import type { RenderSelectionTarget } from "./NodeRenderer.tsx";
import type { DirectEditValue, DocumentEditTarget, TextRange } from "../../../../../foundation/documentEditing.ts";
import type { DirectTextSelection } from "./EditableTextValue.tsx";
import { buildRenderTree } from "./renderTree.ts";
import "./document.css";

export function DocumentRenderer({
  document,
  mode = "screen",
  className,
  selectedNodeId,
  selectableNodeIds,
  onSelect,
  onEditValueChange,
  onRichTextSelection,
  richTextSelection,
}: {
  document: DocumentData;
  mode?: "screen" | "measure" | "print";
  className?: string;
  selectedNodeId?: string;
  selectableNodeIds?: ReadonlySet<string>;
  onSelect?: (target: RenderSelectionTarget) => void;
  onEditValueChange?: (target: DocumentEditTarget, value: DirectEditValue, selection: TextRange) => void;
  onRichTextSelection?: (selection?: DirectTextSelection) => void;
  richTextSelection?: DirectTextSelection;
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
        onEditValueChange={mode === "screen" ? onEditValueChange : undefined}
        onRichTextSelection={mode === "screen" ? onRichTextSelection : undefined}
        richTextSelection={mode === "screen" ? richTextSelection : undefined}
      />
    </div>
  );
}
