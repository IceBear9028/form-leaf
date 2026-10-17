import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeftIcon, CheckIcon, FileDownIcon, MinusIcon, PlusIcon, SaveIcon, XIcon } from "lucide-react";
import type { DocumentData, RichTextMark, RichTextValue } from "../../../../foundation/documentModel.ts";
import type { DocumentSummary } from "../../../../foundation/documentLibrary.ts";
import type { DocumentUpdate, DocumentUpdateOperation } from "../../../../foundation/documentUpdates.ts";
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
  selectComponentNode,
  selectNode,
  selectRepeaterItem,
  type DocumentLayerFocusRequest,
  type DocumentSelection,
} from "./documentSelection.ts";
import { DocumentRenderer } from "./rendering/DocumentRenderer.tsx";
import { PaginatedDocumentRenderer } from "./rendering/PaginatedDocumentRenderer.tsx";
import type { DirectTextSelection } from "./rendering/EditableTextValue.tsx";
import type { RenderSelectionTarget } from "./rendering/NodeRenderer.tsx";
import {
  installPreviewInteractionCapture,
  interactionEventId,
  recordInteraction,
  snapshotSelection,
} from "./interactionDebug.ts";
import {
  type GenericDocumentChange,
  type SaveStateStore,
  useGenericDocumentSession,
} from "./useGenericDocumentSession.ts";
import {
  DEFAULT_PREVIEW_ZOOM,
  MAX_PREVIEW_ZOOM,
  MIN_PREVIEW_ZOOM,
  stepPreviewZoom,
} from "./previewZoom.ts";

const MemoDocumentStructurePanel = memo(DocumentStructurePanel);
const MemoDocumentComponentNavigator = memo(DocumentComponentNavigator);
const MemoDocumentElementToolbar = memo(DocumentElementToolbar);
const MemoPropertyInspector = memo(PropertyInspector);

export const GenericDocumentEditorPage = memo(function GenericDocumentEditorPage({
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
  const [printSnapshot, setPrintSnapshot] = useState<DocumentData>();
  const printReadyRef = useRef<(() => void) | undefined>(undefined);
  const [layerFocusRequest, setLayerFocusRequest] = useState<DocumentLayerFocusRequest>();
  const layerFocusRequestIdRef = useRef(0);
  const previousSelectableNodeIdsRef = useRef<ReadonlySet<string>>(new Set());
  const interactionSelectionRef = useRef(session.selection);
  const previousInteractionSelectionRef = useRef(session.selection);
  const pendingSelectionEventIdRef = useRef<number | undefined>(undefined);
  interactionSelectionRef.current = session.selection;
  const selectableNodeIds = useMemo(() => {
    const next = documentSelectableNodeIds(session.document);
    const previous = previousSelectableNodeIdsRef.current;
    if (sameStringSet(previous, next)) return previous;
    previousSelectableNodeIdsRef.current = next;
    return next;
  }, [session.document]);
  const layerDocumentRef = useRef(session.document);
  const layerDocument = useMemo(() => {
    if (updateAffectsLayer(session.documentUpdate, session.document)) {
      layerDocumentRef.current = session.document;
    }
    return layerDocumentRef.current;
  }, [session.document, session.documentUpdate]);
  const componentDocumentRef = useRef(session.document);
  const componentDocument = useMemo(() => {
    if (updateAffectsComponentNavigator(session.documentUpdate)) {
      componentDocumentRef.current = session.document;
    }
    return componentDocumentRef.current;
  }, [session.document, session.documentUpdate]);
  const inspectorDocumentRef = useRef(session.document);
  const inspectorSelectionKeyRef = useRef(selectionKey(session.selection));
  const inspectorDocument = useMemo(() => {
    const nextSelectionKey = selectionKey(session.selection);
    if (
      inspectorSelectionKeyRef.current !== nextSelectionKey ||
      updateAffectsSelection(session.documentUpdate, session.selection)
    ) {
      inspectorDocumentRef.current = session.document;
    }
    inspectorSelectionKeyRef.current = nextSelectionKey;
    return inspectorDocumentRef.current;
  }, [session.document, session.documentUpdate, session.selection]);

  const updateDocument = useCallback((
    change: GenericDocumentChange,
    operations?: readonly DocumentUpdateOperation[],
  ) => {
    session.updateDocument((current) => {
      const next = typeof change === "function" ? change(current) : change;
      if (next === current) return current;
      pushUndoSnapshot(undoRef.current, current);
      redoRef.current = [];
      return next;
    }, operations);
  }, [session.updateDocument]);

  const selectAndReveal = useCallback((selection?: DocumentSelection, moveFocus?: boolean) => {
    session.setSelection(selection);
    if (!selection) {
      setLayerFocusRequest(undefined);
      return;
    }
    layerFocusRequestIdRef.current += 1;
    setLayerFocusRequest({
      nodeId: selection.nodeId,
      itemId: selectionItemId(selection),
      componentNodeId: selection.kind === "component-node" ? selection.componentNodeId : undefined,
      requestId: layerFocusRequestIdRef.current,
      moveFocus,
    });
  }, [session.setSelection]);

  const selectFromLayer = useCallback((selection?: DocumentSelection) => {
    session.setSelection(selection);
    if (selection) schedulePreviewFocus(previewRef.current, selection);
  }, [session.setSelection]);

  const clearPreviewSelection = () => {
    selectAndReveal(undefined);
    setRichTextSelection(undefined);
    const activeElement = globalThis.document.activeElement;
    if (activeElement instanceof HTMLElement) activeElement.blur();
  };

  const commitDirectEdit = useCallback((
    target: DocumentEditTarget,
    value: DirectEditValue,
    _selection: TextRange,
  ) => {
    updateDocument(
      (current) => updateDocumentEditValue(current, target, value),
      [{ type: "node-content-updated", nodeId: editTargetOwnerNodeId(target) }],
    );
  }, [updateDocument]);

  const selectFromPreview = useCallback((target: RenderSelectionTarget, event?: Event) => {
    const selection = selectionFromRenderTarget(target);
    const eventId = interactionEventId(event);
    pendingSelectionEventIdRef.current = eventId;
    recordInteraction("selection-request", {
      eventId,
      renderTarget: target,
      previousSelection: snapshotSelection(interactionSelectionRef.current),
      requestedSelection: snapshotSelection(selection),
    });
    selectAndReveal(selection, false);
  }, [selectAndReveal]);

  const selectWithoutLayerFocus = useCallback((selection?: DocumentSelection) => {
    selectAndReveal(selection, false);
  }, [selectAndReveal]);

  const markPrintReady = useCallback(() => {
    const resolve = printReadyRef.current;
    printReadyRef.current = undefined;
    resolve?.();
  }, []);

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
    const preview = previewRef.current;
    if (!preview) return;
    return installPreviewInteractionCapture(preview, () => interactionSelectionRef.current);
  }, []);

  useEffect(() => {
    const previous = previousInteractionSelectionRef.current;
    if (previous === session.selection) return;
    recordInteraction("selection-state", {
      eventId: pendingSelectionEventIdRef.current,
      previousSelection: snapshotSelection(previous),
      nextSelection: snapshotSelection(session.selection),
    });
    pendingSelectionEventIdRef.current = undefined;
    previousInteractionSelectionRef.current = session.selection;
  }, [session.selection]);

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
      const snapshot = session.getCurrentDocument();
      const printReady = new Promise<void>((resolve) => {
        printReadyRef.current = resolve;
      });
      setPrintSnapshot(snapshot);
      await printReady;
      const result = await window.documents.exportPdf(snapshot.name);
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
      printReadyRef.current = undefined;
      setPrintSnapshot(undefined);
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
        <SaveIndicator store={session.saveStateStore} onRetry={() => void session.saveNow()} />
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
          <MemoDocumentStructurePanel
            document={layerDocument}
            selection={session.selection}
            focusRequest={layerFocusRequest}
            onSelectionChange={selectFromLayer}
            onChange={updateDocument}
          />
          <MemoDocumentComponentNavigator
            document={componentDocument}
            selection={session.selection}
            onSelectionChange={selectWithoutLayerFocus}
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
              documentUpdate={session.documentUpdate}
              mode="screen"
              selectedNodeId={selectionPreviewNodeId(session.selection)}
              selectedRepeaterItem={selectionPreviewRepeaterItem(session.selection)}
              selectableNodeIds={selectableNodeIds}
              onSelect={selectFromPreview}
              onEditValueChange={commitDirectEdit}
              onRichTextSelection={setRichTextSelection}
              richTextSelection={richTextSelection}
              zoom={zoom}
            />
          </div>
          <div className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2">
            <MemoDocumentElementToolbar
              document={layerDocument}
              selection={session.selection}
              onSelectionChange={selectWithoutLayerFocus}
              onChange={updateDocument}
            />
          </div>
        </main>
        <MemoPropertyInspector
          document={inspectorDocument}
          selection={session.selection}
          onSelectionChange={selectWithoutLayerFocus}
          onChange={updateDocument}
        />
      </div>
      {printSnapshot && (
        <div className="document-print-surface">
          <PaginatedDocumentRenderer
            document={printSnapshot}
            mode="print"
            onLayoutReady={markPrintReady}
          />
        </div>
      )}
      {richTextSelection && <RichTextSelectionToolbar rect={richTextSelection.rect} onFormat={formatRichText} onRemove={removeInlineMark} />}
    </div>
  );
});

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
  const previewScrollRef = useRef<HTMLDivElement>(null);
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
    setLayerFocusRequest({ nodeId, itemId, requestId: layerFocusRequestIdRef.current, moveFocus: false });
  };

  const selectRenderTarget = (target: RenderSelectionTarget) => {
    const nextSelection = selectionFromRenderTarget(target);
    setSelection(nextSelection);
    layerFocusRequestIdRef.current += 1;
    setLayerFocusRequest({
      nodeId: nextSelection.nodeId,
      itemId: selectionItemId(nextSelection),
      componentNodeId: nextSelection.kind === "component-node" ? nextSelection.componentNodeId : undefined,
      requestId: layerFocusRequestIdRef.current,
      moveFocus: false,
    });
  };

  const selectFromLayer = (nextSelection?: DocumentSelection) => {
    setSelection(nextSelection);
    if (nextSelection) schedulePreviewFocus(previewScrollRef.current, nextSelection);
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
            onSelectionChange={selectFromLayer}
            onChange={updateDraft}
          />
          <ComponentDefinitionPanel document={draft} componentId={componentId} onChange={updateDraft} />
        </div>
        <main className="relative min-w-0 overflow-hidden bg-[#e9edf2]" aria-label="컴포넌트 미리보기">
          <div
            ref={previewScrollRef}
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
                onSelect={selectRenderTarget}
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
                  componentNodeId: nextSelection.kind === "component-node" ? nextSelection.componentNodeId : undefined,
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

function selectionFromRenderTarget(target: RenderSelectionTarget): DocumentSelection {
  if (target.componentNodeId) {
    return selectComponentNode(target.nodeId, target.componentNodeId, target.repeaterItemId);
  }
  return target.repeaterItemId
    ? selectRepeaterItem(target.nodeId, target.repeaterItemId)
    : selectNode(target.nodeId);
}

function schedulePreviewFocus(container: HTMLElement | null, selection: DocumentSelection): void {
  if (!container) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const target = closestPreviewSelectionElement(container, selection);
      if (!target) return;
      const focusTarget = target.matches('[contenteditable="true"], [tabindex]')
        ? target
        : target.querySelector<HTMLElement>('[contenteditable="true"], [tabindex]') ?? target;
      focusTarget.focus({ preventScroll: true });
      scrollElementIntoView(container, focusTarget);
    });
  });
}

function closestPreviewSelectionElement(
  container: HTMLElement,
  selection: DocumentSelection,
): HTMLElement | undefined {
  const documentNodes = [...container.querySelectorAll<HTMLElement>("[data-document-node-id]")];
  const repeaterItems = [...container.querySelectorAll<HTMLElement>("[data-repeater-item-id]")];
  let candidates: HTMLElement[];
  if (selection.kind === "component-node") {
    const scopes = selection.itemId
      ? repeaterItems.filter((element) => element.dataset.repeaterItemId === selection.itemId)
      : documentNodes.filter((element) => element.dataset.documentNodeId === selection.nodeId);
    candidates = scopes.flatMap((scope) => (
      [scope, ...scope.querySelectorAll<HTMLElement>("[data-document-node-id]")]
        .filter((element) => element.dataset.documentNodeId === selection.componentNodeId)
    ));
  } else if (selection.kind === "repeater-item") {
    candidates = repeaterItems.filter((element) => element.dataset.repeaterItemId === selection.itemId);
  } else {
    candidates = documentNodes.filter((element) => element.dataset.documentNodeId === selection.nodeId);
  }
  const viewport = container.getBoundingClientRect();
  return candidates.sort((left, right) => (
    elementViewportDistance(left.getBoundingClientRect(), viewport) -
    elementViewportDistance(right.getBoundingClientRect(), viewport)
  ))[0];
}

function elementViewportDistance(element: DOMRect, viewport: DOMRect): number {
  const vertical = element.bottom < viewport.top
    ? viewport.top - element.bottom
    : element.top > viewport.bottom
      ? element.top - viewport.bottom
      : 0;
  const horizontal = element.right < viewport.left
    ? viewport.left - element.right
    : element.left > viewport.right
      ? element.left - viewport.right
      : 0;
  return vertical + horizontal;
}

function scrollElementIntoView(container: HTMLElement, element: HTMLElement): void {
  const viewport = container.getBoundingClientRect();
  const target = element.getBoundingClientRect();
  const margin = 24;
  if (target.top < viewport.top + margin) {
    container.scrollTop -= viewport.top + margin - target.top;
  } else if (target.bottom > viewport.bottom - margin) {
    container.scrollTop += target.bottom - (viewport.bottom - margin);
  }
  if (target.left < viewport.left + margin) {
    container.scrollLeft -= viewport.left + margin - target.left;
  } else if (target.right > viewport.right - margin) {
    container.scrollLeft += target.right - (viewport.right - margin);
  }
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

function SaveIndicator({ store, onRetry }: { store: SaveStateStore; onRetry: () => void }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
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

function pushUndoSnapshot(history: DocumentData[], document: DocumentData): void {
  history.push(document);
  if (history.length > 100) history.shift();
}

function editTargetOwnerNodeId(target: DocumentEditTarget): string {
  if (target.kind === "node") return target.nodeId;
  if (target.kind === "component-prop") return target.instanceNodeId;
  return target.repeaterNodeId;
}

function sameStringSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function updateAffectsLayer(update: DocumentUpdate, document: DocumentData): boolean {
  return update.operations.some((operation) => {
    if (
      operation.type === "document-replaced" ||
      operation.type === "page-settings-updated" ||
      operation.type === "component-definition-updated" ||
      operation.type === "node-inserted" ||
      operation.type === "node-removed" ||
      operation.type === "node-moved" ||
      operation.type === "node-visibility-updated"
    ) return true;
    return operation.type === "node-content-updated" && document.nodes[operation.nodeId]?.type === "repeater";
  });
}

function updateAffectsComponentNavigator(update: DocumentUpdate): boolean {
  return update.operations.some((operation) => (
    operation.type === "document-replaced" ||
    operation.type === "component-definition-updated" ||
    operation.type === "node-inserted" ||
    operation.type === "node-removed" ||
    operation.type === "node-moved"
  ));
}

function updateAffectsSelection(
  update: DocumentUpdate,
  selection: DocumentSelection | undefined,
): boolean {
  if (!selection) return false;
  return update.operations.some((operation) => {
    if (
      operation.type === "document-replaced" ||
      operation.type === "page-settings-updated" ||
      operation.type === "component-definition-updated"
    ) return true;
    if (operation.type === "document-metadata-updated") return false;
    return operation.nodeId === selection.nodeId ||
      (selection.kind === "component-node" && operation.nodeId === selection.componentNodeId);
  });
}

function selectionKey(selection: DocumentSelection | undefined): string {
  if (!selection) return "";
  if (selection.kind === "node") return `node:${selection.nodeId}`;
  if (selection.kind === "repeater-item") return `item:${selection.nodeId}:${selection.itemId}`;
  return `component:${selection.nodeId}:${selection.componentNodeId}`;
}

function usesNativeUndo(activeElement: Element | null, preview: HTMLElement | null): boolean {
  if (!(activeElement instanceof HTMLElement)) return false;
  if (activeElement.isContentEditable) return !preview?.contains(activeElement);
  return activeElement instanceof HTMLInputElement
    || activeElement instanceof HTMLTextAreaElement
    || activeElement instanceof HTMLSelectElement;
}
