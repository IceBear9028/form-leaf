import { useEffect, useMemo, useRef, useState } from "react";
import type { DocumentData } from "../../../../foundation/documentModel.ts";
import type { RichTextMark, RichTextValue } from "../../../../foundation/documentModel.ts";
import { createEmptyDocument } from "../../../../foundation/documentModel.ts";
import {
  readDocumentEditValue,
  removeRichTextMark,
  setRichTextMark,
  toggleRichTextMark,
  updateDocumentEditValue,
  type DirectEditValue,
  type DocumentEditTarget,
  type TextRange,
} from "../../../../foundation/documentEditing.ts";
import { ComponentReusePanel } from "./ComponentReusePanel.tsx";
import { DocumentStructurePanel } from "./DocumentStructurePanel.tsx";
import { PropertyInspector } from "./PropertyInspector.tsx";
import { RichTextSelectionToolbar } from "./RichTextSelectionToolbar.tsx";
import {
  documentSelectableNodeIds,
  selectNode,
} from "./documentSelection.ts";
import { DocumentRenderer } from "./rendering/DocumentRenderer.tsx";
import type { DirectTextSelection } from "./rendering/EditableTextValue.tsx";
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
  const previewRef = useRef<HTMLElement>(null);
  const undoRef = useRef<DocumentData[]>([]);
  const redoRef = useRef<DocumentData[]>([]);
  const [richTextSelection, setRichTextSelection] = useState<DirectTextSelection>();
  const selectableNodeIds = useMemo(
    () => documentSelectableNodeIds(session.document),
    [session.document],
  );

  const commitDirectEdit = (
    target: DocumentEditTarget,
    value: DirectEditValue,
    _selection: TextRange,
  ) => {
    const next = updateDocumentEditValue(session.document, target, value);
    if (next === session.document) return;
    undoRef.current.push(session.document);
    if (undoRef.current.length > 100) undoRef.current.shift();
    redoRef.current = [];
    session.updateDocument(next);
  };

  const formatRichText = (mark: RichTextMark) => {
    if (!richTextSelection) return;
    const current = readDocumentEditValue(session.document, richTextSelection.target);
    if (!isRichTextValue(current)) return;
    const value = mark.type === "link" || mark.type === "color"
      ? setRichTextMark(current, richTextSelection.range, mark)
      : toggleRichTextMark(current, richTextSelection.range, mark);
    commitDirectEdit(richTextSelection.target, value, richTextSelection.range);
  };

  const removeInlineMark = (type: RichTextMark["type"]) => {
    if (!richTextSelection) return;
    const current = readDocumentEditValue(session.document, richTextSelection.target);
    if (!isRichTextValue(current)) return;
    commitDirectEdit(
      richTextSelection.target,
      removeRichTextMark(current, richTextSelection.range, type),
      richTextSelection.range,
    );
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !previewRef.current?.contains(document.activeElement)) return;
      const key = event.key.toLowerCase();
      if (key === "z" || key === "y") {
        event.preventDefault();
        const redo = key === "y" || (key === "z" && event.shiftKey);
        const source = redo ? redoRef.current : undoRef.current;
        const destination = redo ? undoRef.current : redoRef.current;
        const next = source.pop();
        if (!next) return;
        destination.push(session.document);
        session.updateDocument(next);
        return;
      }
      if (!richTextSelection) return;
      const mark: RichTextMark | undefined = key === "b"
        ? { type: "bold" }
        : key === "i"
          ? { type: "italic" }
          : key === "u"
            ? { type: "underline" }
            : undefined;
      if (!mark) return;
      event.preventDefault();
      formatRichText(mark);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

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
      <main ref={previewRef} className="min-w-0 overflow-auto bg-muted/40 p-8" aria-label="Document preview">
        <div className="mx-auto min-h-[297mm] w-[210mm] bg-white p-[18mm] text-black shadow-lg">
          <DocumentRenderer
            document={session.document}
            selectedNodeId={session.selection?.nodeId}
            selectableNodeIds={selectableNodeIds}
            onSelect={({ nodeId }) => session.setSelection(selectNode(nodeId))}
            onEditValueChange={commitDirectEdit}
            onRichTextSelection={setRichTextSelection}
            richTextSelection={richTextSelection}
          />
        </div>
      </main>
      <PropertyInspector
        document={session.document}
        selection={session.selection}
        onChange={session.updateDocument}
      />
      {richTextSelection && (
        <RichTextSelectionToolbar
          rect={richTextSelection.rect}
          onFormat={formatRichText}
          onRemove={removeInlineMark}
        />
      )}
    </div>
  );
}

function isRichTextValue(value: DirectEditValue): value is RichTextValue {
  return typeof value === "object" && "runs" in value;
}
