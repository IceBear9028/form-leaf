import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, CheckIcon, FileDownIcon } from "lucide-react";
import type { DocumentData, RichTextMark, RichTextValue } from "../../../../foundation/documentModel.ts";
import type { DocumentSummary } from "../../../../foundation/documentLibrary.ts";
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
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/spinner";
import { toast } from "@/shared/ui/toast";
import { ComponentReusePanel } from "./ComponentReusePanel.tsx";
import { DocumentStructurePanel } from "./DocumentStructurePanel.tsx";
import { PropertyInspector } from "./PropertyInspector.tsx";
import { RichTextSelectionToolbar } from "./RichTextSelectionToolbar.tsx";
import { documentSelectableNodeIds, selectNode } from "./documentSelection.ts";
import { PaginatedDocumentRenderer } from "./rendering/PaginatedDocumentRenderer.tsx";
import type { DirectTextSelection } from "./rendering/EditableTextValue.tsx";
import { type SaveState, useGenericDocumentSession } from "./useGenericDocumentSession.ts";

export function GenericDocumentEditorPage({
  initialDocument,
  onSummaryChange,
  onBack,
}: {
  initialDocument: DocumentData;
  onSummaryChange: (summary: DocumentSummary) => void;
  onBack: () => Promise<void>;
}) {
  const session = useGenericDocumentSession(initialDocument, onSummaryChange);
  const previewRef = useRef<HTMLElement>(null);
  const undoRef = useRef<DocumentData[]>([]);
  const redoRef = useRef<DocumentData[]>([]);
  const [richTextSelection, setRichTextSelection] = useState<DirectTextSelection>();
  const [exporting, setExporting] = useState(false);
  const [returning, setReturning] = useState(false);
  const selectableNodeIds = useMemo(() => documentSelectableNodeIds(session.document), [session.document]);

  const commitDirectEdit = (target: DocumentEditTarget, value: DirectEditValue, _selection: TextRange) => {
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

  const returnToLibrary = async () => {
    if (returning) return;
    setReturning(true);
    if (await session.saveUntilClean()) await onBack();
    setReturning(false);
  };

  const exportPdf = async () => {
    setExporting(true);
    session.setExportedPath(null);
    if (!await session.saveUntilClean()) {
      setExporting(false);
      return;
    }
    try {
      await window.document.fonts.ready;
      await afterNextPaint();
      const result = await window.documents.exportPdf(session.document.name);
      if (!result.canceled) {
        session.setExportedPath(result.filePath);
        toast.add({
          type: "success",
          title: "PDF 저장 완료",
          description: result.filePath,
          actionProps: {
            children: "Finder에서 보기",
            onClick: () => void window.documents.showInFolder(result.filePath),
          },
        });
      }
    } catch (error) {
      session.setSaveError(`PDF 생성 실패: ${errorMessage(error)}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="app-shell flex h-full flex-col bg-background text-foreground">
      <header className="app-toolbar relative z-20 grid h-16 flex-none grid-cols-[1fr_auto_1fr] items-center gap-5 border-b border-border bg-background px-5 [-webkit-app-region:drag]">
        <div className="flex min-w-0 items-center gap-3">
          <Button type="button" variant="outline" disabled={returning} className="[-webkit-app-region:no-drag]" onClick={() => void returnToLibrary()}>
            {returning ? <Spinner /> : <ArrowLeftIcon aria-hidden="true" />}
            {returning ? "저장 중…" : "문서 목록"}
          </Button>
          <strong className="truncate text-sm font-medium">{session.document.name || "제목 없는 문서"}</strong>
        </div>
        <SaveIndicator state={session.saveState} onRetry={() => void session.saveNow()} />
        <div className="justify-self-end [-webkit-app-region:no-drag]">
          <Button type="button" disabled={exporting} onClick={() => void exportPdf()}>
            {exporting ? <Spinner /> : <FileDownIcon aria-hidden="true" />}
            {exporting ? "PDF 준비 중…" : "PDF 내보내기"}
          </Button>
        </div>
      </header>
      <div className="workspace grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_300px]">
        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(240px,0.75fr)]">
          <DocumentStructurePanel document={session.document} selection={session.selection} onSelectionChange={session.setSelection} onChange={session.updateDocument} />
          <ComponentReusePanel document={session.document} selection={session.selection} onSelectionChange={session.setSelection} onChange={session.updateDocument} />
        </div>
        <main ref={previewRef} className="min-w-0 overflow-auto bg-muted/40 p-8" aria-label="문서 미리보기">
          <PaginatedDocumentRenderer
            document={session.document}
            mode="screen"
            selectedNodeId={session.selection?.nodeId}
            selectableNodeIds={selectableNodeIds}
            onSelect={({ nodeId }) => session.setSelection(selectNode(nodeId))}
            onEditValueChange={commitDirectEdit}
            onRichTextSelection={setRichTextSelection}
            richTextSelection={richTextSelection}
          />
        </main>
        <PropertyInspector document={session.document} selection={session.selection} onChange={session.updateDocument} />
      </div>
      <div className="document-print-surface">
        <PaginatedDocumentRenderer document={session.document} mode="print" />
      </div>
      {richTextSelection && <RichTextSelectionToolbar rect={richTextSelection.rect} onFormat={formatRichText} onRemove={removeInlineMark} />}
    </div>
  );
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state.type === "dirty") return <Badge variant="secondary" className="[-webkit-app-region:no-drag]">저장 대기</Badge>;
  if (state.type === "saving") return <Badge variant="secondary" className="[-webkit-app-region:no-drag]"><Spinner /> 저장 중</Badge>;
  if (state.type === "error") return <Button type="button" variant="destructive" size="sm" className="[-webkit-app-region:no-drag]" title={state.message} onClick={onRetry}>저장 실패 · 다시 시도</Button>;
  const time = new Date(state.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return <Badge variant="outline" className="[-webkit-app-region:no-drag]"><CheckIcon aria-hidden="true" /> 저장됨 · {time}</Badge>;
}

function isRichTextValue(value: DirectEditValue): value is RichTextValue {
  return typeof value === "object" && "runs" in value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}
