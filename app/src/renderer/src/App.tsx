import { useCallback, useEffect, useRef, useState } from "react";
import type { ResumeDocument } from "../../shared/resume";
import { EditorPanel } from "./components/EditorPanel";
import { ResumePreview } from "./components/ResumePreview";

type SaveState =
  | { type: "loading" }
  | { type: "dirty" }
  | { type: "saving" }
  | { type: "saved"; at: string }
  | { type: "error"; message: string };

export function App() {
  const [document, setDocument] = useState<ResumeDocument | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ type: "loading" });
  const [zoom, setZoom] = useState(0.78);
  const [exporting, setExporting] = useState(false);
  const [exportedPath, setExportedPath] = useState<string | null>(null);
  const documentRef = useRef<ResumeDocument | null>(null);
  const saveTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void window.resumeStudio.loadDocument()
      .then((loaded) => {
        if (!active) return;
        documentRef.current = loaded;
        setDocument(loaded);
        setSaveState({ type: "saved", at: loaded.updatedAt });
      })
      .catch((error: unknown) => {
        if (active) setSaveState({ type: "error", message: errorMessage(error) });
      });
    return () => {
      active = false;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  const saveNow = useCallback(async () => {
    const current = documentRef.current;
    if (!current) return false;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    setSaveState({ type: "saving" });
    try {
      const result = await window.resumeStudio.saveDocument(current);
      setSaveState({ type: "saved", at: result.savedAt });
      return true;
    } catch (error) {
      setSaveState({ type: "error", message: errorMessage(error) });
      return false;
    }
  }, []);

  const updateDocument = (next: ResumeDocument) => {
    documentRef.current = next;
    setDocument(next);
    setExportedPath(null);
    setSaveState({ type: "dirty" });
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => void saveNow(), 650);
  };

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

  const exportPdf = async () => {
    if (!document) return;
    setExporting(true);
    setExportedPath(null);
    const saved = await saveNow();
    if (!saved) {
      setExporting(false);
      return;
    }
    try {
      await window.document.fonts.ready;
      await afterNextPaint();
      const result = await window.resumeStudio.exportPdf(document.name);
      if (!result.canceled) setExportedPath(result.filePath);
    } catch (error) {
      setSaveState({ type: "error", message: `PDF 생성 실패: ${errorMessage(error)}` });
    } finally {
      setExporting(false);
    }
  };

  if (!document) {
    return (
      <div className="loading-screen">
        {saveState.type === "error" ? (
          <><strong>이력서를 열지 못했습니다.</strong><span>{saveState.message}</span></>
        ) : (
          <><div className="spinner" /><span>로컬 이력서를 여는 중…</span></>
        )}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-toolbar">
        <div className="brand">
          <div className="brand-mark">R</div>
          <div><strong>Resume Studio</strong><span>로컬 이력서 편집기</span></div>
        </div>
        <SaveIndicator state={saveState} onRetry={() => void saveNow()} />
        <div className="toolbar-actions">
          <div className="zoom-control" aria-label="미리보기 배율">
            <button type="button" onClick={() => setZoom((value) => Math.max(0.5, value - 0.08))} aria-label="축소">−</button>
            <button type="button" className="zoom-value" onClick={() => setZoom(0.78)}>{Math.round(zoom * 100)}%</button>
            <button type="button" onClick={() => setZoom((value) => Math.min(1.15, value + 0.08))} aria-label="확대">＋</button>
          </div>
          <button className="primary-button export-button" type="button" disabled={exporting} onClick={() => void exportPdf()}>
            <PdfIcon /> {exporting ? "PDF 준비 중…" : "PDF 내보내기"}
          </button>
        </div>
      </header>
      {exportedPath && (
        <div className="export-success" role="status">
          <span>PDF를 저장했습니다.</span>
          <button type="button" onClick={() => void window.resumeStudio.showInFolder(exportedPath)}>Finder에서 보기</button>
          <button type="button" className="icon-button" aria-label="알림 닫기" onClick={() => setExportedPath(null)}>×</button>
        </div>
      )}
      <div className="workspace">
        <EditorPanel document={document} onChange={updateDocument} />
        <ResumePreview document={document} zoom={zoom} />
      </div>
    </div>
  );
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state.type === "loading") return <div className="save-indicator">불러오는 중</div>;
  if (state.type === "dirty") return <div className="save-indicator save-indicator--pending"><span />저장 대기</div>;
  if (state.type === "saving") return <div className="save-indicator save-indicator--pending"><span />저장 중</div>;
  if (state.type === "error") {
    return <button type="button" className="save-indicator save-indicator--error" title={state.message} onClick={onRetry}>저장 실패 · 다시 시도</button>;
  }
  const time = new Date(state.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return <div className="save-indicator save-indicator--saved"><span>✓</span> 저장됨 · {time}</div>;
}

function PdfIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v5h5M9.5 14h5M9.5 17h4" /></svg>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
