import { useEffect, useState } from "react";
import type { AgentOperationSummary } from "../../../../foundation/agentConnection.ts";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Alert, AlertDescription } from "@/shared/ui/alert";

const toolNames = { create_document: "문서 생성", apply_operations: "문서 수정", export_pdf: "PDF 출력" };
function statusText(item: AgentOperationSummary): string {
  if (item.status === "recovery_required") return "결과 확인 필요";
  if (item.status === "pending") return "진행 중";
  if (item.status === "failed") return "실패 · 반영되지 않음";
  if (item.persisted && item.uiSynced === false) return "저장 완료 · 화면 반영 미확인";
  return item.tool === "export_pdf" ? "출력 완료" : "저장 완료";
}
export function AgentOperations({ credentialId, embedded = false }: { credentialId?: string; embedded?: boolean } = {}) {
  const [items, setItems] = useState<AgentOperationSummary[]>([]);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let mounted = true; let pending = false;
    const refresh = async () => {
      if (pending) return; pending = true;
      try { const next = await window.documents.agentOperations(); if (mounted) setItems(next); }
      catch { if (mounted) setError("작업 기록을 읽지 못했습니다. 앱을 다시 열어 확인하세요."); }
      finally { pending = false; }
    };
    void refresh(); const interval = setInterval(() => void refresh(), 2000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);
  const act = async (item: AgentOperationSummary, kind: "open" | "save") => {
    setBusy(true); setError(undefined); setNotice(undefined);
    try {
      if (kind === "open") await window.documents.agentOpenArtifact(item.credentialId, item.requestId);
      else { const result = await window.documents.agentSaveArtifact(item.credentialId, item.requestId); if (!result.canceled) setNotice(`PDF를 저장했습니다: ${result.filePath}`); }
    } catch { setError("PDF를 열거나 저장하지 못했습니다. 연결 권한과 파일 만료 여부를 확인하세요."); }
    finally { setBusy(false); }
  };
  const visible = credentialId ? items.filter((item) => item.credentialId === credentialId) : items;
  return <section className={embedded ? "space-y-4" : "space-y-3 rounded-xl border bg-background p-5"} aria-label="최근 에이전트 작업">
    <h2 className="font-semibold">최근 에이전트 작업</h2>
    <p className="text-xs leading-relaxed text-muted-foreground">{credentialId ? "전체 최근 50건 중 이 연결의 작업을 표시합니다." : "최근 50건을 표시합니다."} 연결이 끊겨도 이미 저장한 변경은 유지됩니다. 대화 기록과 문서의 실행 취소 이력은 포함하지 않습니다.</p>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {notice && <p role="status" className="break-all text-sm">{notice}</p>}
    {visible.length === 0 && <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">표시할 작업이 없습니다.</p>}
    {visible.map((item) => <article key={`${item.credentialId}:${item.requestId}`} data-agent-operation={item.requestId} className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap justify-between gap-2"><h3 className="text-sm font-medium">{toolNames[item.tool]}{!credentialId && ` · ${item.connectionName}`}</h3><Badge variant={item.status === "failed" || item.status === "recovery_required" ? "destructive" : "secondary"}>{statusText(item)}</Badge></div>
      <p className="text-sm">{item.accessible ? item.documentName : "문서 권한이 없거나 문서를 사용할 수 없습니다."}</p>
      {item.acceptedAt && <p className="text-xs text-muted-foreground">{new Date(item.acceptedAt).toLocaleString()}</p>}
      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">요청 상세</summary><p className="mt-2 break-all">요청 ID: {item.requestId}</p>{item.revision && <p className="mt-1 break-all">저장 버전: {item.revision}</p>}</details>
      {item.status === "recovery_required" && <p className="text-sm">같은 요청을 새 ID로 다시 실행하지 마세요. 입력 중인 내용을 보존하고 앱을 다시 열어 결과를 확인하세요. 계속 이 상태면 문서와 작업 기록을 보존한 채 점검이 필요합니다.</p>}
      {item.status === "pending" && <p className="text-sm text-muted-foreground">결과를 기다리는 중입니다. 같은 작업을 새 요청으로 반복하지 마세요.</p>}
      {item.status === "failed" && <p className="text-sm">{item.errorCode && <code>{item.errorCode} · </code>}변경이 반영되지 않았습니다. 원인을 해결한 뒤 새 요청으로 진행할 수 있습니다.</p>}
      {item.persisted && item.uiSynced === false && <p className="text-sm">문서는 저장됐습니다. 같은 변경을 다시 저장하지 말고 입력 중인 내용을 보존한 뒤 문서를 다시 열어 확인하세요.</p>}
      {item.artifact && <div className="space-y-2 text-sm"><p>{item.artifact.filename} · {Math.ceil(item.artifact.byteSize / 1024)} KB · 보관 기한 {new Date(item.artifact.expiresAt).toLocaleString()}</p>
        <div className="flex gap-2"><Button variant="outline" disabled={busy || !item.artifact.available} onClick={() => void act(item, "open")}>PDF 열기</Button><Button variant="outline" disabled={busy || !item.artifact.available} onClick={() => void act(item, "save")}>다른 위치에 저장</Button></div>
        {!item.artifact.available && <p className="text-muted-foreground">파일이 만료됐거나 연결이 꺼져 있습니다. 만료된 PDF가 필요하면 새 출력 요청을 만드세요.</p>}
      </div>}
    </article>)}
  </section>;
}
