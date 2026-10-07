import { useState } from "react";
import type { ResumeDocument } from "../../../../foundation/content/resume";
import type { DocumentSummary } from "../../../../foundation/documentLibrary";
import { EditorPanel } from "./components/EditorPanel";
import { ResumePreview } from "./preview/ResumePreview";
import { type SaveState, useDocumentSession } from "./useDocumentSession";

type Props = {
  initialDocument: ResumeDocument;
  onSummaryChange: (summary: DocumentSummary) => void;
  onBack: () => Promise<void>;
};

export function DocumentEditorPage({
  initialDocument,
  onSummaryChange,
  onBack,
}: Props) {
  const session = useDocumentSession(initialDocument, onSummaryChange);
  const [zoom, setZoom] = useState(0.78);
  const [exporting, setExporting] = useState(false);
  const [returning, setReturning] = useState(false);

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
      if (!result.canceled) session.setExportedPath(result.filePath);
    } catch (error) {
      session.setSaveError(`PDF 생성 실패: ${errorMessage(error)}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="app-shell flex h-full flex-col">
      <header className="app-toolbar relative z-20 grid h-16 flex-none grid-cols-[1fr_auto_1fr] items-center gap-5 border-b border-[#dfe3e9] bg-white/[0.97] px-[22px] shadow-[0_1px_8px_rgba(26,34,48,0.04)] [-webkit-app-region:drag]">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-[#dce2ea] bg-white px-2.5 text-xs font-semibold text-[#596779] hover:bg-[#f5f7fa] focus-visible:outline-2 focus-visible:outline-[#3178ff] disabled:cursor-progress disabled:opacity-60 [-webkit-app-region:no-drag]" disabled={returning} onClick={() => void returnToLibrary()}><BackIcon /> {returning ? "저장 중…" : "이력서 목록"}</button>
          <div className="min-w-0"><strong className="block truncate text-sm tracking-[-0.01em]">{session.document.name || "제목 없는 이력서"}</strong><span className="block text-[11px] text-[#8992a1] max-[1180px]:hidden">Resume Studio</span></div>
        </div>
        <SaveIndicator state={session.saveState} onRetry={() => void session.saveNow()} />
        <div className="flex items-center justify-self-end gap-3">
          <div className="flex h-[34px] overflow-hidden rounded-lg border border-[#dce1e8] bg-white" aria-label="미리보기 배율">
            <button type="button" className={zoomButtonClass} onClick={() => setZoom((value) => Math.max(0.5, value - 0.08))} aria-label="축소">−</button>
            <button type="button" className={`${zoomButtonClass} w-[54px] border-x border-[#e5e8ed] text-xs font-[650]`} onClick={() => setZoom(0.78)}>{Math.round(zoom * 100)}%</button>
            <button type="button" className={zoomButtonClass} onClick={() => setZoom((value) => Math.min(1.15, value + 0.08))} aria-label="확대">＋</button>
          </div>
          <button className="inline-flex cursor-pointer items-center justify-center gap-[7px] rounded-lg border border-transparent bg-[#1768e5] px-3.5 py-[9px] font-[650] text-white shadow-[0_3px_10px_rgba(23,104,229,0.18)] hover:bg-[#0d5dce] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3178ff] disabled:cursor-progress disabled:opacity-60 [-webkit-app-region:no-drag] [&_svg]:h-4 [&_svg]:w-4 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8]" type="button" disabled={exporting} onClick={() => void exportPdf()}><PdfIcon /> {exporting ? "PDF 준비 중…" : "PDF 내보내기"}</button>
        </div>
      </header>
      {session.exportedPath && (
        <div className="export-success fixed right-[18px] top-[75px] z-80 flex items-center gap-2.5 rounded-[9px] border border-[#cce7d9] bg-[#f4fbf7] px-3 py-2.5 text-xs text-[#256343] shadow-[0_7px_25px_rgba(35,55,45,0.13)]" role="status"><span>PDF를 저장했습니다.</span><button type="button" className="cursor-pointer border-0 bg-transparent text-[11px] text-[#1768e5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3178ff]" onClick={() => void window.documents.showInFolder(session.exportedPath!)}>Finder에서 보기</button><button type="button" className="cursor-pointer border-0 bg-transparent text-base text-[#6d7e73] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3178ff]" aria-label="알림 닫기" onClick={() => session.setExportedPath(null)}>×</button></div>
      )}
      <div className="workspace grid min-h-0 flex-1 [grid-template-columns:minmax(420px,500px)_minmax(0,1fr)] max-[1180px]:[grid-template-columns:420px_minmax(0,1fr)]">
        <EditorPanel document={session.document} onChange={session.updateDocument} />
        <ResumePreview document={session.document} zoom={zoom} onChange={session.updateDocument} />
      </div>
    </div>
  );
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
