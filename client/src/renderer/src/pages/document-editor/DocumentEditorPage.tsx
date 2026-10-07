import { useState } from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  FileDownIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react";
import type { ResumeDocument } from "../../../../foundation/content/resume";
import type { DocumentSummary } from "../../../../foundation/documentLibrary";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ButtonGroup } from "@/shared/ui/button-group";
import { Spinner } from "@/shared/ui/spinner";
import { toast } from "@/shared/ui/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { EditorPanel } from "./resume/components/EditorPanel";
import { ResumePreview } from "./resume/preview/ResumePreview";
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
      <header className="app-toolbar relative z-20 grid h-16 flex-none grid-cols-[1fr_auto_1fr] items-center gap-5 border-b bg-background px-5 [-webkit-app-region:drag]">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={returning}
            className="[-webkit-app-region:no-drag]"
            onClick={() => void returnToLibrary()}
          >
            {returning ? <Spinner /> : <ArrowLeftIcon aria-hidden="true" />}
            {returning ? "저장 중…" : "이력서 목록"}
          </Button>
          <div className="min-w-0">
            <strong className="block truncate text-sm font-medium">
              {session.document.name || "제목 없는 이력서"}
            </strong>
            <span className="block text-xs text-muted-foreground max-[1180px]:hidden">Resume Studio</span>
          </div>
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
                    onClick={() => setZoom((value) => Math.max(0.5, value - 0.08))}
                  />
                }
              >
                <MinusIcon aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>축소</TooltipContent>
            </Tooltip>
            <Button type="button" variant="outline" className="w-14" onClick={() => setZoom(0.78)}>
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
                    onClick={() => setZoom((value) => Math.min(1.15, value + 0.08))}
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
      <div className="workspace grid min-h-0 flex-1 [grid-template-columns:minmax(420px,500px)_minmax(0,1fr)] max-[1180px]:[grid-template-columns:420px_minmax(0,1fr)]">
        <EditorPanel document={session.document} onChange={session.updateDocument} />
        <ResumePreview document={session.document} zoom={zoom} onChange={session.updateDocument} />
      </div>
    </div>
  );
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state.type === "dirty") return <Badge variant="secondary" className="[-webkit-app-region:no-drag]">저장 대기</Badge>;
  if (state.type === "saving") return <Badge variant="secondary" className="[-webkit-app-region:no-drag]"><Spinner /> 저장 중</Badge>;
  if (state.type === "error") {
    return (
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="[-webkit-app-region:no-drag]"
        title={state.message}
        onClick={onRetry}
      >
        저장 실패 · 다시 시도
      </Button>
    );
  }
  const time = new Date(state.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return <Badge variant="outline" className="[-webkit-app-region:no-drag]"><CheckIcon aria-hidden="true" /> 저장됨 · {time}</Badge>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}
