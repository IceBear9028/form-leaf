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

  const updateDocument = (
    change: ResumeDocument | ((current: ResumeDocument) => ResumeDocument),
  ) => {
    const current = documentRef.current;
    if (!current) return;
    const next = typeof change === "function" ? change(current) : change;
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
      <div className="flex h-full w-full flex-col items-center justify-center gap-[13px] bg-[#f4f6f8] text-[13px] text-[#687384]">
        {saveState.type === "error" ? (
          <><strong className="text-[15px] text-[#283344]">이력서를 열지 못했습니다.</strong><span>{saveState.message}</span></>
        ) : (
          <><div className="h-6 w-6 animate-spin rounded-full border-2 border-[#dce2e9] border-t-[#1768e5]" /><span>로컬 이력서를 여는 중…</span></>
        )}
      </div>
    );
  }

  return (
    <div className="app-shell flex h-full flex-col">
      <header className="app-toolbar relative z-20 grid h-16 flex-none grid-cols-[1fr_auto_1fr] items-center gap-5 border-b border-[#dfe3e9] bg-white/[0.97] px-[22px] shadow-[0_1px_8px_rgba(26,34,48,0.04)] [-webkit-app-region:drag]">
        <div className="flex items-center gap-[11px]">
          <div className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-[#1768e5] text-[17px] font-extrabold text-white shadow-[0_4px_12px_rgba(23,104,229,0.24)]">R</div>
          <div className="flex flex-col gap-0.5">
            <strong className="text-sm tracking-[-0.01em]">Resume Studio</strong>
            <span className="text-[11px] text-[#8992a1] max-[1180px]:hidden">로컬 이력서 편집기</span>
          </div>
        </div>
        <SaveIndicator state={saveState} onRetry={() => void saveNow()} />
        <div className="flex items-center justify-self-end gap-3">
          <div className="flex h-[34px] overflow-hidden rounded-lg border border-[#dce1e8] bg-white" aria-label="미리보기 배율">
            <button type="button" className={zoomButtonClass} onClick={() => setZoom((value) => Math.max(0.5, value - 0.08))} aria-label="축소">−</button>
            <button type="button" className={`${zoomButtonClass} w-[54px] border-x border-[#e5e8ed] text-xs font-[650]`} onClick={() => setZoom(0.78)}>{Math.round(zoom * 100)}%</button>
            <button type="button" className={zoomButtonClass} onClick={() => setZoom((value) => Math.min(1.15, value + 0.08))} aria-label="확대">＋</button>
          </div>
          <button className="inline-flex cursor-pointer items-center justify-center gap-[7px] rounded-lg border border-transparent bg-[#1768e5] px-3.5 py-[9px] font-[650] text-white shadow-[0_3px_10px_rgba(23,104,229,0.18)] hover:bg-[#0d5dce] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3178ff] disabled:cursor-progress disabled:opacity-60 [-webkit-app-region:no-drag] [&_svg]:h-4 [&_svg]:w-4 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8]" type="button" disabled={exporting} onClick={() => void exportPdf()}>
            <PdfIcon /> {exporting ? "PDF 준비 중…" : "PDF 내보내기"}
          </button>
        </div>
      </header>
      {exportedPath && (
        <div className="export-success fixed right-[18px] top-[75px] z-80 flex items-center gap-2.5 rounded-[9px] border border-[#cce7d9] bg-[#f4fbf7] px-3 py-2.5 text-xs text-[#256343] shadow-[0_7px_25px_rgba(35,55,45,0.13)]" role="status">
          <span>PDF를 저장했습니다.</span>
          <button type="button" className="cursor-pointer border-0 bg-transparent text-[11px] text-[#1768e5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3178ff]" onClick={() => void window.resumeStudio.showInFolder(exportedPath)}>Finder에서 보기</button>
          <button type="button" className="cursor-pointer border-0 bg-transparent text-base text-[#6d7e73] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3178ff]" aria-label="알림 닫기" onClick={() => setExportedPath(null)}>×</button>
        </div>
      )}
      <div className="workspace grid min-h-0 flex-1 [grid-template-columns:minmax(420px,500px)_minmax(0,1fr)] max-[1180px]:[grid-template-columns:420px_minmax(0,1fr)]">
        <EditorPanel document={document} onChange={updateDocument} />
        <ResumePreview document={document} zoom={zoom} onChange={updateDocument} />
      </div>
    </div>
  );
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state.type === "loading") return <div className={saveIndicatorClass}>불러오는 중</div>;
  if (state.type === "dirty") return <div className={saveIndicatorClass}><span className="h-[7px] w-[7px] rounded-full bg-[#e5a323]" />저장 대기</div>;
  if (state.type === "saving") return <div className={saveIndicatorClass}><span className="h-[7px] w-[7px] rounded-full bg-[#e5a323]" />저장 중</div>;
  if (state.type === "error") {
    return <button type="button" className={`${saveIndicatorClass} cursor-pointer text-[#c74747] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3178ff]`} title={state.message} onClick={onRetry}>저장 실패 · 다시 시도</button>;
  }
  const time = new Date(state.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return <div className={saveIndicatorClass}><span className="inline-grid h-[15px] w-[15px] place-items-center rounded-full bg-[#e6f6ef] text-[#17875b]">✓</span> 저장됨 · {time}</div>;
}

const saveIndicatorClass = "inline-flex items-center gap-1.5 whitespace-nowrap border-0 bg-transparent text-xs text-[#778190] [-webkit-app-region:no-drag]";
const zoomButtonClass = "w-[34px] cursor-pointer border-0 bg-white text-[#667080] hover:bg-[#f5f7fa] hover:text-[#1a2431] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#3178ff] [-webkit-app-region:no-drag]";

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
