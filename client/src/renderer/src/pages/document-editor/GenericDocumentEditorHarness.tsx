import { useMemo } from "react";
import type { DocumentData } from "../../../../foundation/documentModel.ts";
import { createEmptyDocument } from "../../../../foundation/documentModel.ts";
import { ComponentReusePanel } from "./ComponentReusePanel.tsx";
import { DocumentStructurePanel } from "./DocumentStructurePanel.tsx";
import { PropertyInspector } from "./PropertyInspector.tsx";
import {
  documentSelectableNodeIds,
  selectNode,
} from "./documentSelection.ts";
import { DocumentRenderer } from "./rendering/DocumentRenderer.tsx";
import { useGenericDocumentSession } from "./useGenericDocumentSession.ts";

export function GenericDocumentEditorHarness({
  initialDocument,
}: {
  initialDocument?: DocumentData;
}) {
  const seed = useMemo(
    () => initialDocument ?? createEmptyDocument({ name: "Untitled document" }),
    [initialDocument],
  );
  const session = useGenericDocumentSession(seed);
  const selectableNodeIds = useMemo(
    () => documentSelectableNodeIds(session.document),
    [session.document],
  );

  return (
    <div className="grid h-full min-h-0 grid-cols-[280px_minmax(0,1fr)_300px] bg-background text-foreground">
      <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(240px,0.75fr)]">
        <DocumentStructurePanel
          document={session.document}
          selection={session.selection}
          onSelectionChange={session.setSelection}
          onChange={session.updateDocument}
        />
        <ComponentReusePanel
          document={session.document}
          selection={session.selection}
          onSelectionChange={session.setSelection}
          onChange={session.updateDocument}
        />
      </div>
      <main className="min-w-0 overflow-auto bg-muted/40 p-8" aria-label="Document preview">
        <div className="mx-auto min-h-[297mm] w-[210mm] bg-white p-[18mm] text-black shadow-lg">
          <DocumentRenderer
            document={session.document}
            selectedNodeId={session.selection?.nodeId}
            selectableNodeIds={selectableNodeIds}
            onSelect={({ nodeId }) => session.setSelection(selectNode(nodeId))}
          />
        </div>
      </main>
      <PropertyInspector
        document={session.document}
        selection={session.selection}
        onChange={session.updateDocument}
      />
    </div>
  );
}
