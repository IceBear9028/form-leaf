import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, CheckIcon, FileDownIcon, MinusIcon, PlusIcon, SaveIcon, XIcon } from "lucide-react";
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
import {
  applyComponentDocumentDraft,
  createComponentDocumentDraft,
} from "../../../../foundation/documentComponentOperations.ts";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ButtonGroup } from "@/shared/ui/button-group";
import { Spinner } from "@/shared/ui/spinner";
import { toast } from "@/shared/ui/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { DocumentComponentNavigator } from "./DocumentComponentNavigator.tsx";
import { ComponentDirectManipulationOverlay } from "./ComponentDirectManipulationOverlay.tsx";
import { ComponentDefinitionPanel } from "./ComponentReusePanel.tsx";
import { DocumentElementToolbar, DocumentStructurePanel } from "./DocumentStructurePanel.tsx";
import { PropertyInspector } from "./PropertyInspector.tsx";
import { RichTextSelectionToolbar } from "./RichTextSelectionToolbar.tsx";
import {
  documentSelectableNodeIds,
  reconcileDocumentSelection,
  selectNode,
  selectRepeaterItem,
  type DocumentLayerFocusRequest,
  type DocumentSelection,
} from "./documentSelection.ts";
import { DocumentRenderer } from "./rendering/DocumentRenderer.tsx";
import { PaginatedDocumentRenderer } from "./rendering/PaginatedDocumentRenderer.tsx";
import type { DirectTextSelection } from "./rendering/EditableTextValue.tsx";
import {
  type GenericDocumentChange,
  type SaveState,
  useGenericDocumentSession,
} from "./useGenericDocumentSession.ts";
import {
  DEFAULT_PREVIEW_ZOOM,
  MAX_PREVIEW_ZOOM,
  MIN_PREVIEW_ZOOM,
  stepPreviewZoom,
} from "./previewZoom.ts";

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
  const previewRef = useRef<HTMLDivElement>(null);
  const undoRef = useRef<DocumentData[]>([]);
  const redoRef = useRef<DocumentData[]>([]);
  const [richTextSelection, setRichTextSelection] = useState<DirectTextSelection>();
  const [zoom, setZoom] = useState(DEFAULT_PREVIEW_ZOOM);
  const [exporting, setExporting] = useState(false);
  const [returning, setReturning] = useState(false);
  const [editingComponentId, setEditingComponentId] = useState<string>();
  const [layerFocusRequest, setLayerFocusRequest] = useState<DocumentLayerFocusRequest>();
  const layerFocusRequestIdRef = useRef(0);
  const selectableNodeIds = useMemo(() => documentSelectableNodeIds(session.document), [session.document]);

  const updateDocument = (change: GenericDocumentChange) => {
    session.updateDocument((current) => {
      const next = typeof change === "function" ? change(current) : change;
      if (next === current) return current;
      pushUndoSnapshot(undoRef.current, current);
      redoRef.current = [];
      return next;
    });
  };

  const selectAndReveal = (selection?: DocumentSelection, moveFocus?: boolean) => {
    session.setSelection(selection);
    if (!selection) {
      setLayerFocusRequest(undefined);
      return;
    }
    layerFocusRequestIdRef.current += 1;
    setLayerFocusRequest({
      nodeId: selection.nodeId,
      itemId: selectionItemId(selection),
      requestId: layerFocusRequestIdRef.current,
      moveFocus,
    });
  };

  const clearPreviewSelection = () => {
    selectAndReveal(undefined);
    setRichTextSelection(undefined);
    const activeElement = globalThis.document.activeElement;
    if (activeElement instanceof HTMLElement) activeElement.blur();
  };

  const commitDirectEdit = (target: DocumentEditTarget, value: DirectEditValue, _selection: TextRange) => {
    updateDocument((current) => updateDocumentEditValue(current, target, value));
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
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z" || key === "y") {
        if (usesNativeUndo(globalThis.document.activeElement, previewRef.current)) return;
        event.preventDefault();
        const redo = key === "y" || (key === "z" && event.shiftKey);
        const source = redo ? redoRef.current : undoRef.current;
        const destination = redo ? undoRef.current : redoRef.current;
        const next = source.pop();
        if (!next) return;
        session.updateDocument((current) => {
          pushUndoSnapshot(destination, current);
          return next;
        });
        return;
      }
      if (!previewRef.current?.contains(globalThis.document.activeElement)) return;
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

  if (editingComponentId && session.document.components[editingComponentId]) {
    return (
      <ComponentEditorScreen
        key={editingComponentId}
        sourceDocument={session.document}
        componentId={editingComponentId}
        onCancel={() => setEditingComponentId(undefined)}
        onSave={(document) => {
          updateDocument((current) => applyComponentDocumentDraft(current, editingComponentId, document));
          session.setSelection(undefined);
          setEditingComponentId(undefined);
        }}
      />
    );
  }

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
        <div className="flex items-center justify-self-end gap-3 [-webkit-app-region:no-drag]">
          <ButtonGroup aria-label="미리보기 배율">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="축소"
                    disabled={zoom <= MIN_PREVIEW_ZOOM}
                    onClick={() => setZoom((value) => stepPreviewZoom(value, -1))}
                  />
                }
              >
                <MinusIcon aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>축소</TooltipContent>
            </Tooltip>
            <Button type="button" variant="outline" className="w-14 tabular-nums" onClick={() => setZoom(DEFAULT_PREVIEW_ZOOM)}>
              {Math.round(zoom * 100)}%
            </Button>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="확대"
                    disabled={zoom >= MAX_PREVIEW_ZOOM}
                    onClick={() => setZoom((value) => stepPreviewZoom(value, 1))}
                  />
                }
              >
                <PlusIcon aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>확대</TooltipContent>
            </Tooltip>
          </ButtonGroup>
          <Button type="button" disabled={exporting} onClick={() => void exportPdf()}>
            {exporting ? <Spinner /> : <FileDownIcon aria-hidden="true" />}
            {exporting ? "PDF 준비 중…" : "PDF 내보내기"}
          </Button>
        </div>
      </header>
      <div className="workspace grid min-h-0 flex-1 grid-cols-[288px_minmax(0,1fr)_320px]">
        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(220px,0.72fr)]">
          <DocumentStructurePanel
            document={session.document}
            selection={session.selection}
            focusRequest={layerFocusRequest}
            onSelectionChange={(selection) => selectAndReveal(selection, false)}
            onChange={updateDocument}
          />
          <DocumentComponentNavigator
            document={session.document}
            selection={session.selection}
            onSelectionChange={(selection) => selectAndReveal(selection, false)}
            onChange={updateDocument}
            onEditComponent={setEditingComponentId}
          />
        </div>
        <main className="relative min-w-0 overflow-hidden bg-[#e9edf2]" aria-label="문서 미리보기">
          <div
            ref={previewRef}
            className="h-full overflow-auto overscroll-contain px-10 pb-[100px] pt-[34px] max-[1180px]:px-6"
            onClick={(event) => {
              const target = event.target;
              if (!(target instanceof Element)) return;
              if (target.closest("[data-document-node-id]")) return;
              clearPreviewSelection();
            }}
          >
            <PaginatedDocumentRenderer
              document={session.document}
              mode="screen"
              selectedNodeId={selectionPreviewNodeId(session.selection)}
              selectedRepeaterItem={selectionPreviewRepeaterItem(session.selection)}
              selectableNodeIds={selectableNodeIds}
              onSelect={({ nodeId, repeaterItemId }) => selectAndReveal(
                repeaterItemId ? selectRepeaterItem(nodeId, repeaterItemId) : selectNode(nodeId),
              )}
              onEditValueChange={commitDirectEdit}
              onRichTextSelection={setRichTextSelection}
              richTextSelection={richTextSelection}
              zoom={zoom}
            />
          </div>
          <div className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2">
            <DocumentElementToolbar
              document={session.document}
              selection={session.selection}
              onSelectionChange={(selection) => selectAndReveal(selection, false)}
              onChange={updateDocument}
            />
          </div>
        </main>
        <PropertyInspector
          document={session.document}
          selection={session.selection}
          onSelectionChange={(selection) => selectAndReveal(selection, false)}
          onChange={updateDocument}
        />
      </div>
      <div className="document-print-surface">
        <PaginatedDocumentRenderer document={session.document} mode="print" />
      </div>
      {richTextSelection && <RichTextSelectionToolbar rect={richTextSelection.rect} onFormat={formatRichText} onRemove={removeInlineMark} />}
    </div>
  );
}

function ComponentEditorScreen({
  sourceDocument,
  componentId,
  onCancel,
  onSave,
}: {
  sourceDocument: DocumentData;
  componentId: string;
  onCancel: () => void;
  onSave: (document: DocumentData) => void;
}) {
  const [draft, setDraft] = useState<DocumentData>(() => createComponentDocumentDraft(sourceDocument, componentId));
  const component = draft.components[componentId];
  const [selection, setSelection] = useState<DocumentSelection | undefined>(() => selectNode(component.rootNodeId));
  const undoRef = useRef<DocumentData[]>([]);
  const redoRef = useRef<DocumentData[]>([]);
  const [layerFocusRequest, setLayerFocusRequest] = useState<DocumentLayerFocusRequest>();
  const layerFocusRequestIdRef = useRef(0);
  const [richTextSelection, setRichTextSelection] = useState<DirectTextSelection>();
  const componentCanvasRef = useRef<HTMLDivElement>(null);
  const selectableNodeIds = useMemoComponentNodeIds(draft, component.rootNodeId);

  const updateDraft = (change: DocumentData | ((current: DocumentData) => DocumentData)) => {
    setDraft((current) => {
      const next = typeof change === "function" ? change(current) : change;
      if (next === current) return current;
      pushUndoSnapshot(undoRef.current, current);
      redoRef.current = [];
      return next;
    });
  };

  const selectFromPreview = (nodeId: string, itemId?: string) => {
    setSelection(itemId ? selectRepeaterItem(nodeId, itemId) : selectNode(nodeId));
    layerFocusRequestIdRef.current += 1;
    setLayerFocusRequest({ nodeId, itemId, requestId: layerFocusRequestIdRef.current });
  };

  const clearPreviewSelection = () => {
    setSelection(undefined);
    setLayerFocusRequest(undefined);
    setRichTextSelection(undefined);
    const activeElement = globalThis.document.activeElement;
    if (activeElement instanceof HTMLElement) activeElement.blur();
  };

  useEffect(() => {
    setSelection((current) => {
      if (!current || !selectableNodeIds.has(current.nodeId) || draft.nodes[current.nodeId]?.archivedFrom) {
        return selectNode(component.rootNodeId);
      }
      return reconcileDocumentSelection(draft, current) ?? selectNode(component.rootNodeId);
    });
  }, [component.rootNodeId, draft, selectableNodeIds]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      if (usesNativeUndo(globalThis.document.activeElement, componentCanvasRef.current)) return;
      event.preventDefault();
      const redo = key === "y" || (key === "z" && event.shiftKey);
      const source = redo ? redoRef.current : undoRef.current;
      const destination = redo ? undoRef.current : redoRef.current;
      const next = source.pop();
      if (!next) return;
      setDraft((current) => {
        pushUndoSnapshot(destination, current);
        return next;
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const commitDirectEdit = (target: DocumentEditTarget, value: DirectEditValue, _selection: TextRange) => {
    setDraft((current) => updateDocumentEditValue(current, target, value));
  };

  const formatRichText = (mark: RichTextMark) => {
    if (!richTextSelection) return;
    const current = readDocumentEditValue(draft, richTextSelection.target);
    if (!isRichTextValue(current)) return;
    const value = mark.type === "link" || mark.type === "color"
      ? setRichTextMark(current, richTextSelection.range, mark)
      : toggleRichTextMark(current, richTextSelection.range, mark);
    commitDirectEdit(richTextSelection.target, value, richTextSelection.range);
  };

  const removeInlineMark = (type: RichTextMark["type"]) => {
    if (!richTextSelection) return;
    const current = readDocumentEditValue(draft, richTextSelection.target);
    if (!isRichTextValue(current)) return;
    commitDirectEdit(
      richTextSelection.target,
      removeRichTextMark(current, richTextSelection.range, type),
      richTextSelection.range,
    );
  };

  return (
    <div className="app-shell flex h-full flex-col bg-background text-foreground">
      <header className="app-toolbar relative z-20 grid h-16 flex-none grid-cols-[1fr_auto_1fr] items-center gap-5 border-b border-border bg-background px-5 [-webkit-app-region:drag]">
        <div className="flex min-w-0 items-center gap-3 [-webkit-app-region:no-drag]">
          <Button type="button" variant="outline" onClick={onCancel}>
            <ArrowLeftIcon aria-hidden="true" /> 콘텐츠로
          </Button>
          <div className="min-w-0">
            <strong className="block truncate text-sm font-medium">{component.name || "이름 없는 컴포넌트"}</strong>
            <span className="block text-[11px] text-muted-foreground">공통 컴포넌트 원본</span>
          </div>
        </div>
        <Badge variant="secondary" className="[-webkit-app-region:no-drag]">컴포넌트 편집</Badge>
        <div className="flex items-center justify-self-end gap-2 [-webkit-app-region:no-drag]">
          <Button type="button" variant="outline" onClick={onCancel}><XIcon aria-hidden="true" /> 취소</Button>
          <Button type="button" onClick={() => onSave(draft)}><SaveIcon aria-hidden="true" /> 변경사항 저장</Button>
        </div>
      </header>
      <div className="workspace grid min-h-0 flex-1 grid-cols-[288px_minmax(0,1fr)_320px]">
        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(220px,0.72fr)]">
          <DocumentStructurePanel
            document={draft}
            rootNodeId={component.rootNodeId}
            selection={selection}
            focusRequest={layerFocusRequest}
            onSelectionChange={setSelection}
            onChange={updateDraft}
          />
          <ComponentDefinitionPanel document={draft} componentId={componentId} onChange={updateDraft} />
        </div>
        <main className="relative min-w-0 overflow-hidden bg-[#e9edf2]" aria-label="컴포넌트 미리보기">
          <div
            className="h-full overflow-auto overscroll-contain px-10 pb-28 pt-[34px] max-[1180px]:px-6"
            onClick={(event) => {
              const target = event.target;
              if (!(target instanceof Element)) return;
              if (target.closest("[data-document-node-id], [data-component-drag-handle]")) return;
              clearPreviewSelection();
            }}
          >
            <div className="mx-auto mb-3 flex w-fit items-center gap-2 rounded-full border border-border bg-background/95 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm">
              요소를 선택한 뒤 파란 영역을 그대로 드래그하세요.
              <span className="font-medium text-foreground">Auto Layout은 즉시 재배치 · 자유 위치는 좌표 이동</span>
            </div>
            <div ref={componentCanvasRef} className="document-page mx-auto h-auto min-h-[180px] overflow-visible shadow-[0_8px_28px_rgb(43_53_68_/_13%),0_1px_3px_rgb(43_53_68_/_12%)]">
              <DocumentRenderer
                document={draft}
                rootNodeId={component.rootNodeId}
                mode="screen"
                selectedNodeId={selectionPreviewNodeId(selection)}
                selectedRepeaterItem={selectionPreviewRepeaterItem(selection)}
                selectableNodeIds={selectableNodeIds}
                onSelect={({ nodeId, repeaterItemId }) => selectFromPreview(nodeId, repeaterItemId)}
                onEditValueChange={commitDirectEdit}
                onRichTextSelection={setRichTextSelection}
                richTextSelection={richTextSelection}
              />
              <ComponentDirectManipulationOverlay
                canvasRef={componentCanvasRef}
                document={draft}
                selection={selection?.kind === "node" ? selection : undefined}
                componentRootNodeId={component.rootNodeId}
                onSelectionChange={selectFromPreview}
                onChange={updateDraft}
              />
            </div>
          </div>
          <div className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2">
            <DocumentElementToolbar
              document={draft}
              rootNodeId={component.rootNodeId}
              selection={selection}
              onSelectionChange={(nextSelection) => {
                setSelection(nextSelection);
                if (!nextSelection) return;
                layerFocusRequestIdRef.current += 1;
                setLayerFocusRequest({
                  nodeId: nextSelection.nodeId,
                  itemId: selectionItemId(nextSelection),
                  requestId: layerFocusRequestIdRef.current,
                  moveFocus: false,
                });
              }}
              onChange={updateDraft}
            />
          </div>
        </main>
        <PropertyInspector
          document={draft}
          selection={selection}
          onSelectionChange={setSelection}
          onChange={updateDraft}
        />
      </div>
      {richTextSelection && <RichTextSelectionToolbar rect={richTextSelection.rect} onFormat={formatRichText} onRemove={removeInlineMark} />}
    </div>
  );
}

function selectionItemId(selection: DocumentSelection): string | undefined {
  if (selection.kind === "repeater-item") return selection.itemId;
  return selection.kind === "component-node" ? selection.itemId : undefined;
}

function selectionPreviewNodeId(selection?: DocumentSelection): string | undefined {
  if (selection?.kind === "node") return selection.nodeId;
  return selection?.kind === "component-node" && !selection.itemId ? selection.nodeId : undefined;
}

function selectionPreviewRepeaterItem(
  selection?: DocumentSelection,
): { nodeId: string; itemId: string } | undefined {
  const itemId = selection ? selectionItemId(selection) : undefined;
  return selection && itemId ? { nodeId: selection.nodeId, itemId } : undefined;
}

function useMemoComponentNodeIds(document: DocumentData, rootNodeId: string): ReadonlySet<string> {
  return useMemo(() => {
    const ids = new Set<string>();
    const visit = (nodeId: string) => {
      if (ids.has(nodeId)) return;
      ids.add(nodeId);
      const node = document.nodes[nodeId];
      if (node?.type === "container") node.childIds.forEach(visit);
    };
    visit(rootNodeId);
    return ids;
  }, [document, rootNodeId]);
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

function pushUndoSnapshot(history: DocumentData[], document: DocumentData): void {
  history.push(document);
  if (history.length > 100) history.shift();
}

function usesNativeUndo(activeElement: Element | null, preview: HTMLElement | null): boolean {
  if (!(activeElement instanceof HTMLElement)) return false;
  if (activeElement.isContentEditable) return !preview?.contains(activeElement);
  return activeElement instanceof HTMLInputElement
    || activeElement instanceof HTMLTextAreaElement
    || activeElement instanceof HTMLSelectElement;
}
