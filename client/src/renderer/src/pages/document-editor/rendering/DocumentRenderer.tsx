import { useMemo } from "react";
import type { DocumentData } from "../../../../../foundation/documentModel.ts";
import { NodeRenderer } from "./NodeRenderer.tsx";
import type { ActiveEditTarget, RenderSelectionMode, RenderSelectionTarget } from "./NodeRenderer.tsx";
import type { DirectEditValue, DocumentEditTarget, TextRange } from "../../../../../foundation/documentEditing.ts";
import type { DirectTextSelection } from "./EditableTextValue.tsx";
import { buildRenderTree } from "./renderTree.ts";
import "./document.css";

export function DocumentRenderer({
  document,
  rootNodeId,
  mode = "screen",
  className,
  selectedNodeId,
  selectedRepeaterItem,
  selectableNodeIds,
  selectionMode = "content",
  onSelect,
  activeEditTarget,
  onEditActivate,
  onEditValueChange,
  onRichTextSelection,
  richTextSelection,
}: {
  document: DocumentData;
  rootNodeId?: string;
  mode?: "screen" | "measure" | "print";
  className?: string;
  selectedNodeId?: string;
  selectedRepeaterItem?: { nodeId: string; itemId: string };
  selectableNodeIds?: ReadonlySet<string>;
  selectionMode?: RenderSelectionMode;
  onSelect?: (target: RenderSelectionTarget) => void;
  activeEditTarget?: ActiveEditTarget;
  onEditActivate?: (target: DocumentEditTarget, renderId: string, event?: Event) => void;
  onEditValueChange?: (target: DocumentEditTarget, value: DirectEditValue, selection: TextRange) => void;
  onRichTextSelection?: (selection?: DirectTextSelection) => void;
  richTextSelection?: DirectTextSelection;
}) {
  const tree = useMemo(() => buildRenderTree(document, rootNodeId), [document, rootNodeId]);
  return (
    <div
      className={["document-renderer", `document-renderer--${mode}`, className].filter(Boolean).join(" ")}
      data-document-render-mode={mode}
    >
      <NodeRenderer
        node={tree}
        measure={mode === "measure"}
        selectedNodeId={selectedNodeId}
        selectedRepeaterItem={selectedRepeaterItem}
        selectableNodeIds={selectableNodeIds}
        selectionMode={selectionMode}
        onSelect={onSelect}
        activeEditTarget={mode === "screen" ? activeEditTarget : undefined}
        onEditActivate={mode === "screen" ? onEditActivate : undefined}
        onEditValueChange={mode === "screen" ? onEditValueChange : undefined}
        onRichTextSelection={mode === "screen" ? onRichTextSelection : undefined}
        richTextSelection={mode === "screen" ? richTextSelection : undefined}
      />
    </div>
  );
}
