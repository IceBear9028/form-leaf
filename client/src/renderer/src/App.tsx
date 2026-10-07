import { useCallback, useEffect, useRef, useState } from "react";
import type { ResumeDocument } from "../../foundation/content/resume";
import {
  sortDeletedDocumentSummaries,
  sortDocumentSummaries,
  type DeletedDocumentSummary,
  type DocumentSummary,
} from "../../foundation/documentLibrary";
import { EditorPanel } from "./components/EditorPanel";
import { ResumeLibrary, ResumeTrash } from "./components/ResumeLibrary";
import { ResumePreview } from "./components/ResumePreview";

type AppView =
  | { type: "library" }
  | { type: "trash" }
  | { type: "editor"; document: ResumeDocument };

type SaveState =
  | { type: "dirty" }
  | { type: "saving" }
  | { type: "saved"; at: string }
  | { type: "error"; message: string };

export function App() {
  const [view, setView] = useState<AppView>({ type: "library" });
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [deletedDocuments, setDeletedDocuments] = useState<DeletedDocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>();
  const [libraryError, setLibraryError] = useState<string>();

  const loadLibrary = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setLibraryError(undefined);
    try {
      const [active, deleted] = await Promise.all([
        window.documents.listDocuments(),
        window.documents.listDeletedDocuments(),
      ]);
      setDocuments(sortDocumentSummaries(active));
      setDeletedDocuments(sortDeletedDocumentSummaries(deleted));
      return true;
    } catch (error) {
      setLibraryError(errorMessage(error));
      return false;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const createDocument = async () => {
    if (busyId) return;
    setBusyId("create");
    setLibraryError(undefined);
    try {
      const created = await window.documents.createDocument();
      setDocuments((current) => sortDocumentSummaries([...current, created.summary]));
      setView({ type: "editor", document: created.document });
    } catch (error) {
      setLibraryError(errorMessage(error));
    } finally {
      setBusyId(undefined);
    }
  };

  const openDocument = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setLibraryError(undefined);
    try {
      const document = await window.documents.loadDocument(id);
      setView({ type: "editor", document });
    } catch (error) {
      setLibraryError(errorMessage(error));
    } finally {
      setBusyId(undefined);
    }
  };

  const renameDocument = async (id: string, title: string) => {
    if (busyId) return false;
    setBusyId(id);
    setLibraryError(undefined);
    try {
      const summary = await window.documents.renameDocument(id, title);
      setDocuments((current) => sortDocumentSummaries(current.map((item) =>
        item.id === id ? summary : item,
      )));
      return true;
    } catch (error) {
      setLibraryError(errorMessage(error));
      return false;
    } finally {
      setBusyId(undefined);
    }
  };

  const deleteDocument = async (id: string) => {
    if (busyId) return false;
    setBusyId(id);
    setLibraryError(undefined);
    try {
      await window.documents.deleteDocument(id);
      await loadLibrary(false);
      return true;
    } catch (error) {
      setLibraryError(errorMessage(error));
      return false;
    } finally {
      setBusyId(undefined);
    }
  };

  const restoreDocument = async (id: string) => {
    if (busyId) return false;
    setBusyId(id);
    setLibraryError(undefined);
    try {
      await window.documents.restoreDocument(id);
      await loadLibrary(false);
      return true;
    } catch (error) {
      setLibraryError(errorMessage(error));
      return false;
    } finally {
      setBusyId(undefined);
    }
  };

  const permanentlyDeleteDocument = async (id: string) => {
    if (busyId) return false;
    setBusyId(id);
    setLibraryError(undefined);
    try {
      await window.documents.permanentlyDeleteDocument(id);
      await loadLibrary(false);
      return true;
    } catch (error) {
      setLibraryError(errorMessage(error));
      return false;
    } finally {
      setBusyId(undefined);
    }
  };

  const openRestoredDocument = async (id: string) => {
    await openDocument(id);
  };

  if (loading) return <LoadingScreen label="이력서 목록을 불러오는 중…" />;

  if (view.type === "editor") {
    return (
      <ResumeEditor
        key={view.document.documentId}
        initialDocument={view.document}
        onSummaryChange={(summary) => {
          setDocuments((current) => sortDocumentSummaries(current.map((item) =>
            item.id === summary.id ? summary : item,
          )));
        }}
        onBack={async () => {
          await loadLibrary(false);
          setView({ type: "library" });
        }}
      />
    );
  }

  if (view.type === "trash") {
    return (
      <ResumeTrash
        documents={deletedDocuments}
        busyId={busyId}
        error={libraryError}
        onBack={() => setView({ type: "library" })}
        onRestore={restoreDocument}
        onPermanentlyDelete={permanentlyDeleteDocument}
        onOpenRestored={openRestoredDocument}
        onRetry={() => void loadLibrary(false)}
      />
    );
  }

  return (
    <ResumeLibrary
      documents={documents}
      deletedCount={deletedDocuments.length}
      busyId={busyId}
      error={libraryError}
      onCreate={createDocument}
      onOpen={openDocument}
      onRename={renameDocument}
      onDelete={deleteDocument}
      onOpenTrash={() => setView({ type: "trash" })}
      onRetry={() => void loadLibrary()}
    />
  );
}

function ResumeEditor({
  initialDocument,
  onSummaryChange,
  onBack,
}: {
  initialDocument: ResumeDocument;
  onSummaryChange: (summary: DocumentSummary) => void;
  onBack: () => Promise<void>;
}) {
  const [document, setDocument] = useState(initialDocument);
  const [saveState, setSaveState] = useState<SaveState>({ type: "saved", at: initialDocument.updatedAt });
  const [zoom, setZoom] = useState(0.78);
  const [exporting, setExporting] = useState(false);
  const [returning, setReturning] = useState(false);
  const [exportedPath, setExportedPath] = useState<string | null>(null);
  const documentRef = useRef(initialDocument);
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<number | undefined>(undefined);
  const inFlightSaveRef = useRef<Promise<boolean> | undefined>(undefined);

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = undefined;
    }
    if (inFlightSaveRef.current) {
      const completed = await inFlightSaveRef.current;
      if (!completed) return false;
    }
    if (!dirtyRef.current) return true;

    const current = documentRef.current;
    dirtyRef.current = false;
    setSaveState({ type: "saving" });
    const request = window.documents.saveDocument(current.documentId, current)
      .then((summary) => {
        onSummaryChange(summary);
        setSaveState(dirtyRef.current ? { type: "dirty" } : { type: "saved", at: summary.updatedAt });
        return true;
      })
      .catch((error: unknown) => {
        dirtyRef.current = true;
        setSaveState({ type: "error", message: errorMessage(error) });
        return false;
      });
    inFlightSaveRef.current = request;
    const completed = await request;
    if (inFlightSaveRef.current === request) inFlightSaveRef.current = undefined;
    return completed;
  }, [onSummaryChange]);

  const updateDocument = (
    change: ResumeDocument | ((current: ResumeDocument) => ResumeDocument),
  ) => {
    const current = documentRef.current;
    const next = typeof change === "function" ? change(current) : change;
    documentRef.current = next;
    setDocument(next);
    setExportedPath(null);
    dirtyRef.current = true;
    setSaveState({ type: "dirty" });
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => void saveNow(), 650);
  };

  useEffect(() => () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveNow();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveNow]);

  const returnToLibrary = async () => {
    if (returning) return;
    setReturning(true);
    let saved = await saveNow();
    if (saved && dirtyRef.current) saved = await saveNow();
    if (saved) await onBack();
    setReturning(false);
  };

  const exportPdf = async () => {
    setExporting(true);
    setExportedPath(null);
    let saved = await saveNow();
    if (saved && dirtyRef.current) saved = await saveNow();
    if (!saved) {
      setExporting(false);
      return;
    }
    try {
      await window.document.fonts.ready;
      await afterNextPaint();
      const result = await window.documents.exportPdf(documentRef.current.name);
      if (!result.canceled) setExportedPath(result.filePath);
    } catch (error) {
      setSaveState({ type: "error", message: `PDF 생성 실패: ${errorMessage(error)}` });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="app-shell flex h-full flex-col">
      <header className="app-toolbar relative z-20 grid h-16 flex-none grid-cols-[1fr_auto_1fr] items-center gap-5 border-b border-[#dfe3e9] bg-white/[0.97] px-[22px] shadow-[0_1px_8px_rgba(26,34,48,0.04)] [-webkit-app-region:drag]">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-[#dce2ea] bg-white px-2.5 text-xs font-semibold text-[#596779] hover:bg-[#f5f7fa] focus-visible:outline-2 focus-visible:outline-[#3178ff] disabled:cursor-progress disabled:opacity-60 [-webkit-app-region:no-drag]" disabled={returning} onClick={() => void returnToLibrary()}><BackIcon /> {returning ? "저장 중…" : "이력서 목록"}</button>
          <div className="min-w-0"><strong className="block truncate text-sm tracking-[-0.01em]">{document.name || "제목 없는 이력서"}</strong><span className="block text-[11px] text-[#8992a1] max-[1180px]:hidden">Resume Studio</span></div>
        </div>
        <SaveIndicator state={saveState} onRetry={() => void saveNow()} />
        <div className="flex items-center justify-self-end gap-3">
          <div className="flex h-[34px] overflow-hidden rounded-lg border border-[#dce1e8] bg-white" aria-label="미리보기 배율">
            <button type="button" className={zoomButtonClass} onClick={() => setZoom((value) => Math.max(0.5, value - 0.08))} aria-label="축소">−</button>
            <button type="button" className={`${zoomButtonClass} w-[54px] border-x border-[#e5e8ed] text-xs font-[650]`} onClick={() => setZoom(0.78)}>{Math.round(zoom * 100)}%</button>
            <button type="button" className={zoomButtonClass} onClick={() => setZoom((value) => Math.min(1.15, value + 0.08))} aria-label="확대">＋</button>
          </div>
          <button className="inline-flex cursor-pointer items-center justify-center gap-[7px] rounded-lg border border-transparent bg-[#1768e5] px-3.5 py-[9px] font-[650] text-white shadow-[0_3px_10px_rgba(23,104,229,0.18)] hover:bg-[#0d5dce] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3178ff] disabled:cursor-progress disabled:opacity-60 [-webkit-app-region:no-drag] [&_svg]:h-4 [&_svg]:w-4 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8]" type="button" disabled={exporting} onClick={() => void exportPdf()}><PdfIcon /> {exporting ? "PDF 준비 중…" : "PDF 내보내기"}</button>
        </div>
      </header>
      {exportedPath && (
        <div className="export-success fixed right-[18px] top-[75px] z-80 flex items-center gap-2.5 rounded-[9px] border border-[#cce7d9] bg-[#f4fbf7] px-3 py-2.5 text-xs text-[#256343] shadow-[0_7px_25px_rgba(35,55,45,0.13)]" role="status"><span>PDF를 저장했습니다.</span><button type="button" className="cursor-pointer border-0 bg-transparent text-[11px] text-[#1768e5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3178ff]" onClick={() => void window.documents.showInFolder(exportedPath)}>Finder에서 보기</button><button type="button" className="cursor-pointer border-0 bg-transparent text-base text-[#6d7e73] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3178ff]" aria-label="알림 닫기" onClick={() => setExportedPath(null)}>×</button></div>
      )}
      <div className="workspace grid min-h-0 flex-1 [grid-template-columns:minmax(420px,500px)_minmax(0,1fr)] max-[1180px]:[grid-template-columns:420px_minmax(0,1fr)]">
        <EditorPanel document={document} onChange={updateDocument} />
        <ResumePreview document={document} zoom={zoom} onChange={updateDocument} />
      </div>
    </div>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return <div className="flex h-full w-full flex-col items-center justify-center gap-[13px] bg-[#f4f6f8] text-[13px] text-[#687384]"><div className="h-6 w-6 animate-spin rounded-full border-2 border-[#dce2e9] border-t-[#1768e5]" /><span>{label}</span></div>;
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state.type === "dirty") return <div className={saveIndicatorClass}><span className="h-[7px] w-[7px] rounded-full bg-[#e5a323]" />저장 대기</div>;
  if (state.type === "saving") return <div className={saveIndicatorClass}><span className="h-[7px] w-[7px] rounded-full bg-[#e5a323]" />저장 중</div>;
  if (state.type === "error") return <button type="button" className={`${saveIndicatorClass} cursor-pointer text-[#c74747] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3178ff]`} title={state.message} onClick={onRetry}>저장 실패 · 다시 시도</button>;
  const time = new Date(state.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return <div className={saveIndicatorClass}><span className="inline-grid h-[15px] w-[15px] place-items-center rounded-full bg-[#e6f6ef] text-[#17875b]">✓</span> 저장됨 · {time}</div>;
}

const saveIndicatorClass = "inline-flex items-center gap-1.5 whitespace-nowrap border-0 bg-transparent text-xs text-[#778190] [-webkit-app-region:no-drag]";
const zoomButtonClass = "w-[34px] cursor-pointer border-0 bg-white text-[#667080] hover:bg-[#f5f7fa] hover:text-[#1a2431] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#3178ff] [-webkit-app-region:no-drag]";

function PdfIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v5h5M9.5 14h5M9.5 17h4" /></svg>; }
function BackIcon() { return <svg className="h-4 w-4 fill-none stroke-current stroke-[1.8]" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>; }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}
