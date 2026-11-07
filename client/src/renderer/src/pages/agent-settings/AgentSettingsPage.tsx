import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, CheckIcon, CopyIcon, PlusIcon, PlugIcon, ShieldCheckIcon } from "lucide-react";
import type { AgentConnection, AgentSettings, AgentTokenLifetime } from "../../../../foundation/agentConnection.ts";
import type { DocumentSummary } from "../../../../foundation/documentLibrary.ts";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/shared/ui/alert-dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";
import { Spinner } from "@/shared/ui/spinner";
import { toast } from "@/shared/ui/toast";
import { AgentConnectionDetail } from "./AgentConnectionDetail.tsx";
import { AgentConnectionWizard, TokenLifetime } from "./AgentConnectionWizard.tsx";
import { AgentIcon, agentClients, ConnectionStatus, copyAgentText, formatAgentDate } from "./agentConnectionUi.tsx";

type Confirmation = { kind: "rotate" | "revoke"; connection: AgentConnection } | { kind: "discard"; proceed: () => void };
export function AgentSettingsPage({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState<AgentSettings>();
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [detailVersion, setDetailVersion] = useState(0);
  const [wizard, setWizard] = useState<{ initial?: { connection: AgentConnection; token?: string } }>();
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [days, setDays] = useState<AgentTokenLifetime>(30);
  const [error, setError] = useState<string>();
  const [confirmationError, setConfirmationError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);
  const refreshSequence = useRef(0);
  const active = useRef(true);
  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    try {
      const [next, listed] = await Promise.all([window.documents.agentSettings(), window.documents.listDocuments()]);
      if (active.current && sequence === refreshSequence.current) { setSettings(next); setDocuments(listed); }
    } catch { if (active.current && sequence === refreshSequence.current) setError("연결 정보를 읽지 못했습니다. 잠시 후 다시 시도하세요."); }
  }, []);
  useEffect(() => {
    active.current = true;
    let pending = false;
    const poll = async () => { if (pending) return; pending = true; try { await refresh(); } finally { pending = false; } };
    void poll(); const interval = setInterval(() => void poll(), 2000);
    return () => { active.current = false; ++refreshSequence.current; clearInterval(interval); };
  }, [refresh]);
  const selected = settings?.connections.find((connection) => connection.id === selectedId) ?? settings?.connections[0];
  const onDirtyChange = useCallback((value: boolean) => { dirty.current = value; }, []);
  const navigate = (proceed: () => void) => { if (dirty.current) setConfirmation({ kind: "discard", proceed }); else proceed(); };
  const run = async (action: () => Promise<unknown>, title?: string) => {
    setBusy(true); setError(undefined);
    try { await action(); await refresh(); if (title) toast.add({ type: "success", title }); return true; }
    catch { setError("설정을 저장하지 못했습니다. 다시 시도하세요."); return false; }
    finally { setBusy(false); }
  };
  const issued = (connection: AgentConnection) => {
    ++refreshSequence.current;
    setSettings((previous) => previous ? { ...previous, connections: previous.connections.some((item) => item.id === connection.id) ? previous.connections.map((item) => item.id === connection.id ? connection : item) : [...previous.connections, connection] } : previous);
    setSelectedId(connection.id); dirty.current = false; void refresh();
  };
  const confirm = async () => {
    if (!confirmation || busy) return;
    if (confirmation.kind === "discard") { dirty.current = false; setDetailVersion((value) => value + 1); setConfirmation(undefined); confirmation.proceed(); return; }
    setBusy(true); setConfirmationError(undefined);
    try {
      if (confirmation.kind === "rotate") {
        const result = await window.documents.agentRotateToken(confirmation.connection.id, days);
        issued(result.connection); setConfirmation(undefined); setWizard({ initial: result });
      } else {
        await window.documents.agentRevoke(confirmation.connection.id);
        dirty.current = false; setConfirmation(undefined); await refresh(); toast.add({ type: "success", title: "이 연결의 접근을 해제했습니다." });
      }
    } catch { setConfirmationError("처리하지 못했습니다. 연결 상태를 확인하고 다시 시도하세요."); }
    finally { setBusy(false); }
  };
  const confirmConnection = (kind: "rotate" | "revoke", connection: AgentConnection) => navigate(() => { setDays(30); setConfirmationError(undefined); setConfirmation({ kind, connection }); });
  return <div className="flex h-full min-h-0 flex-col bg-muted/30 text-foreground">
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background px-5 [-webkit-app-region:drag]"><Button variant="outline" disabled={busy} className="[-webkit-app-region:no-drag]" onClick={() => navigate(onBack)}><ArrowLeftIcon aria-hidden="true" />문서 목록</Button><strong className="text-sm font-medium">에이전트 연결</strong></header>
    <main className="min-h-0 flex-1 overflow-y-auto px-8 py-9 max-sm:px-5"><div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="m-0 text-2xl font-semibold tracking-tight">함께 쓰는 에이전트</h1><p className="m-0 mt-2 text-sm text-muted-foreground">익숙한 AI 도구에 필요한 문서만 열어주세요.</p></div><Button disabled={!settings || busy} onClick={() => navigate(() => setWizard({}))}><PlusIcon aria-hidden="true" />에이전트 연결</Button></div>
      {(error || settings?.error) && <Alert variant="destructive"><AlertTitle>연결 설정을 확인해 주세요</AlertTitle><AlertDescription>{error ?? settings?.error}</AlertDescription><Button variant="outline" size="sm" className="mt-2 w-fit" onClick={() => { setError(undefined); void refresh(); }}>다시 확인</Button></Alert>}
      {!settings ? <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground"><Spinner />연결 정보를 불러오는 중입니다.</div> : <>
        <Card size="sm"><CardContent className="flex-row flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-muted"><PlugIcon className="size-5" aria-hidden="true" /></span><div><h2 className="m-0 text-sm font-medium">{settings.running ? "이 컴퓨터에서 연결을 받고 있어요" : "에이전트 연결이 꺼져 있어요"}</h2><p className="m-0 mt-1 text-xs text-muted-foreground">{settings.running ? "허용한 토큰과 문서 권한을 확인한 뒤 요청을 처리합니다." : "연결을 켜면 허용한 에이전트가 접근할 수 있습니다."}</p></div></div><Button variant="outline" disabled={busy} onClick={() => void run(() => window.documents.agentEnable(!settings.enabled))}>{busy && <Spinner />}{settings.enabled ? "연결 일시 중지" : "연결 켜기"}</Button></CardContent></Card>
        {!settings.connections.length ? <Empty className="min-h-80 border bg-background"><EmptyHeader><EmptyMedia variant="icon"><PlugIcon /></EmptyMedia><EmptyTitle>첫 에이전트를 연결해 보세요</EmptyTitle><EmptyDescription>Codex나 Claude Code가 사용할 문서와 작업 범위를 정할 수 있습니다.</EmptyDescription></EmptyHeader><EmptyContent><Button onClick={() => setWizard({})}><PlusIcon />첫 연결 만들기</Button></EmptyContent></Empty> : <div className="grid items-start gap-6 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.3fr)]">
          <section className="min-w-0 space-y-3" aria-label="내 연결"><div className="mb-4 flex items-center justify-between"><h2 className="m-0 text-sm font-medium">내 연결 <span className="ml-1 text-muted-foreground">{settings.connections.length}</span></h2><span className="text-xs text-muted-foreground">연결별 접근 관리</span></div>
            {settings.connections.map((connection) => <Card key={connection.id} size="sm" className={`py-0 ${selected?.id === connection.id ? "ring-2 ring-primary" : ""}`}><Button variant="ghost" className="h-auto w-full bg-card flex-col items-stretch gap-4 whitespace-normal rounded-xl p-4 text-left" aria-pressed={selected?.id === connection.id} disabled={busy} onClick={() => { if (selected?.id !== connection.id) navigate(() => setSelectedId(connection.id)); }}><span className="flex items-center gap-3"><AgentIcon type={connection.clientType} /><span className="min-w-0 flex-1"><span className="block break-words font-medium">{connection.name}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{agentClients[connection.clientType ?? "other"].name}</span></span><ConnectionStatus connection={connection} settings={settings} /></span><span className="text-xs font-normal">문서 {connection.grants.documentIds.length}개 · {connection.grants.write ? "읽기·수정" : "읽기 전용"}{connection.grants.render ? " · PDF 출력" : ""}</span><span className="border-t border-border pt-3 text-xs font-normal text-muted-foreground">최근 인증 요청 {formatAgentDate(connection.lastUsedAt)}</span></Button></Card>)}
            <div className="flex gap-2 px-1 pt-4 text-xs leading-relaxed text-muted-foreground"><ShieldCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><p className="m-0">AI 계정 로그인은 외부 도구에서 진행합니다. 이곳에서는 Formleaf 문서 접근 권한을 관리합니다.</p></div>
          </section>
          {selected && <AgentConnectionDetail key={`${selected.id}:${detailVersion}`} connection={selected} settings={settings} documents={documents} busy={busy} onDirtyChange={onDirtyChange} onSave={(grants) => run(() => window.documents.agentSetGrants(selected.id, grants), "권한을 저장했습니다.")} onSetup={() => navigate(() => setWizard({ initial: { connection: selected } }))} onRotate={() => confirmConnection("rotate", selected)} onRevoke={() => confirmConnection("revoke", selected)} />}
        </div>}
        <details className="rounded-lg border border-border bg-background px-4 py-3 text-xs text-muted-foreground"><summary className="cursor-pointer">연결 주소와 접근 범위 안내</summary><div className="mt-3 space-y-3"><div className="flex flex-wrap items-center gap-2"><code className="break-all">{settings.endpoint}</code><Button variant="ghost" size="sm" onClick={() => void copyAgentText(settings.endpoint, "연결 주소를 복사했습니다.")}><CopyIcon />주소 복사</Button></div><p className="m-0">Formleaf를 실행해 둔 동안 이 컴퓨터에서 사용할 수 있습니다. 이 권한은 Formleaf 도구 호출에 적용되며 외부 에이전트의 별도 터미널·파일 접근 권한은 해당 클라이언트에서 관리해야 합니다.</p></div></details>
      </>}
    </div></main>
    {wizard && settings && <AgentConnectionWizard settings={settings} documents={documents} initial={wizard.initial} onIssued={issued} onClose={() => setWizard(undefined)} />}
    <AlertDialog open={!!confirmation} onOpenChange={(open) => { if (!open && !busy) { setConfirmation(undefined); setConfirmationError(undefined); } }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle className="m-0">{confirmation?.kind === "discard" ? "저장하지 않은 변경을 버릴까요?" : confirmation?.kind === "rotate" ? "연결 토큰을 교체할까요?" : "이 연결의 접근을 해제할까요?"}</AlertDialogTitle><AlertDialogDescription className="m-0">{confirmation?.kind === "discard" ? "편집 중인 권한 설정은 저장되지 않습니다." : confirmation?.kind === "rotate" ? "기존 토큰은 즉시 사용할 수 없게 됩니다. 문서 권한과 작업 기록은 유지되며 CLI에 새 토큰을 설정해야 합니다." : "기존 토큰으로 더 이상 문서를 읽거나 수정할 수 없습니다. 이미 저장된 문서 변경과 작업 기록은 유지됩니다."}</AlertDialogDescription></AlertDialogHeader>{confirmation?.kind === "rotate" && <TokenLifetime value={days} onChange={setDays} disabled={busy} />}{confirmationError && <Alert variant="destructive"><AlertDescription>{confirmationError}</AlertDescription></Alert>}<AlertDialogFooter><AlertDialogCancel disabled={busy}>취소</AlertDialogCancel><AlertDialogAction variant={confirmation?.kind === "revoke" ? "destructive" : "default"} disabled={busy} onClick={() => void confirm()}>{busy ? <Spinner /> : <CheckIcon />}{confirmation?.kind === "discard" ? "변경 버리기" : confirmation?.kind === "rotate" ? "새 토큰으로 교체" : "접근 해제"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
