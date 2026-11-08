import { runAction } from "@/shared/lib/async-errors";
import { useId, useState } from "react";
import { CheckIcon, CopyIcon, PlugIcon, ArrowLeftIcon, XIcon } from "lucide-react";
import type { AgentClientType, AgentConnection, AgentSettings, AgentTokenLifetime, IssuedAgentConnection } from "../../../../foundation/agentConnection.ts";
import type { DocumentSummary } from "../../../../foundation/documentLibrary.ts";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Spinner } from "@/shared/ui/spinner";
import { AgentGrantFields, blankAgentGrants } from "./AgentGrantFields.tsx";
import { AgentClientExamples } from "./AgentClientExamples.tsx";
import { AgentIcon, agentClients, copyAgentText, formatAgentDate, tokenExpired } from "./agentConnectionUi.tsx";

export function AgentConnectionWizard({ settings, documents, initial, onIssued, onClose }: {
  settings: AgentSettings; documents: DocumentSummary[];
  initial?: { connection: AgentConnection; token?: string };
  onIssued: (connection: AgentConnection) => void; onClose: () => void;
}) {
  const [step, setStep] = useState(initial ? 2 : 0);
  const [clientType, setClientType] = useState<AgentClientType>(initial?.connection.clientType ?? "codex");
  const [name, setName] = useState("Codex");
  const [grants, setGrants] = useState(blankAgentGrants);
  const [days, setDays] = useState<AgentTokenLifetime>(30);
  const [issued, setIssued] = useState<{ connection: AgentConnection; token?: string } | undefined>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const id = useId();
  const observed = settings.connections.find((item) => item.id === issued?.connection.id) ?? issued?.connection;
  const confirmed = !!observed?.lastUsedAt && settings.running && !observed.revoked && !tokenExpired(observed);
  const issue = async () => {
    if (busy || !name.trim()) return;
    setBusy(true); setError(undefined);
    try {
      const result: IssuedAgentConnection = await window.documents.agentCreateConnection(name, { clientType, expiresInDays: days, grants });
      setIssued(result); onIssued(result.connection); setStep(2);
    } catch { setError("연결을 만들지 못했습니다. 문서 목록과 입력을 확인한 뒤 다시 시도하세요."); }
    finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent showCloseButton={false} className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
      <DialogHeader className="shrink-0 border-b border-border p-6 pb-0">
        <div className="flex items-center justify-between gap-3"><DialogTitle className="m-0">{step < 2 ? "에이전트 연결하기" : `${issued?.connection.name} 연결 설정`}</DialogTitle><Button variant="ghost" size="icon-sm" disabled={busy} onClick={onClose} aria-label="연결 설정 닫기"><XIcon /></Button></div>
        <DialogDescription className="m-0">사용할 도구와 허용 범위를 정하고 연결을 확인하세요.</DialogDescription>
        <ol className="m-0 mt-4 grid list-none grid-cols-4 gap-2 p-0" aria-label="연결 단계">{["도구 선택", "문서와 권한", "연결 설정", "연결 확인"].map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} className={`border-b-2 py-3 text-xs ${index <= step ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground"}`}><span className="mr-1">{index + 1}.</span>{label}</li>)}</ol>
      </DialogHeader>
      <div className="min-h-0 overflow-y-auto p-6">
        {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}
        {step === 0 && <div className="space-y-3"><p className="m-0 mb-4 text-sm text-muted-foreground">어떤 도구에서 Formleaf를 사용할까요?</p>{Object.entries(agentClients).map(([type, client]) => <Button key={type} variant="outline" className={`h-auto w-full justify-start gap-3 whitespace-normal p-4 text-left ${clientType === type ? "border-primary bg-accent" : ""}`} aria-pressed={clientType === type} onClick={() => { setClientType(type as AgentClientType); setName(client.name); }}><AgentIcon type={type as AgentClientType} /><span className="flex-1"><span className="block font-medium">{client.name}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{client.description}</span></span>{clientType === type && <CheckIcon aria-hidden="true" />}</Button>)}<p className="m-0 pt-3 text-xs text-muted-foreground">AI 계정 로그인은 선택한 도구에서 진행합니다.</p></div>}
        {step === 1 && <div className="space-y-6"><div className="space-y-2"><Label htmlFor={`${id}-name`}>연결 이름</Label><Input id={`${id}-name`} maxLength={200} value={name} onChange={(event) => setName(event.target.value)} disabled={busy} /></div><AgentGrantFields value={grants} onChange={setGrants} documents={documents} disabled={busy} /><TokenLifetime value={days} onChange={setDays} disabled={busy} />{!grants.documentIds.length && !grants.create && <p className="m-0 text-xs text-muted-foreground">선택한 문서가 없습니다. 연결 후에도 문서 접근 권한을 추가할 수 있습니다.</p>}</div>}
        {step === 2 && <div className="space-y-6">
          <section className="space-y-2"><h3 className="m-0 text-sm font-medium">Formleaf 연결 토큰</h3>{issued?.token ? <><Input aria-label="연결 토큰" readOnly value={issued.token} className="font-mono text-xs" /><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => runAction((copyAgentText(issued.token!, "연결 토큰을 복사했습니다.")))}><CopyIcon aria-hidden="true" />토큰 복사</Button><Button variant="ghost" size="sm" onClick={() => setIssued({ connection: issued.connection })}>토큰 숨기기</Button></div><p className="m-0 text-xs text-muted-foreground">이 창을 닫으면 원문을 다시 볼 수 없습니다. 잃어버렸다면 연결 · 보안에서 교체하세요.</p></> : <p className="m-0 text-sm text-muted-foreground">발급받은 토큰을 사용하세요. 분실했다면 연결 · 보안에서 새 토큰으로 교체할 수 있습니다.</p>}</section>
          {!settings.running && <Alert role="note"><AlertDescription>현재 연결이 꺼져 있습니다. 설정을 마친 뒤 Formleaf의 연결을 켜주세요.</AlertDescription></Alert>}
          <AgentClientExamples endpoint={settings.endpoint} clientType={clientType} />
        </div>}
        {step === 3 && <div className="space-y-5"><div className="rounded-xl border border-border bg-muted/30 px-5 py-8 text-center"><span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-background">{confirmed ? <CheckIcon aria-hidden="true" /> : <PlugIcon aria-hidden="true" />}</span><h3 className="m-0 text-lg font-medium">{confirmed ? "인증된 요청을 확인했어요" : !settings.running ? "Formleaf 연결을 켜주세요" : observed && tokenExpired(observed) ? "토큰이 만료됐어요" : "첫 요청을 기다리고 있어요"}</h3><p className="m-0 mt-2 text-sm text-muted-foreground">{confirmed ? formatAgentDate(observed?.lastUsedAt) : "CLI에서 연결 설정을 마친 뒤 Formleaf 도구를 호출해 주세요."}</p></div><p className="m-0 text-xs leading-relaxed text-muted-foreground">서버가 현재 토큰으로 인증된 MCP 요청을 받으면 자동으로 갱신됩니다. AI 로그인 상태나 CLI가 계속 실행 중인지는 확인하지 않습니다.</p>{observed && <div className="rounded-lg border border-border p-4 text-sm">허용 문서 {observed.grants.documentIds.length}개 · {observed.grants.write ? "읽기·수정" : "읽기 전용"}{observed.grants.render ? " · PDF 출력" : ""}</div>}</div>}
      </div>
      <DialogFooter className="shrink-0 border-t border-border p-4 sm:justify-between">
        <Button variant="ghost" disabled={busy} onClick={() => step === 0 || step === 2 ? onClose() : setStep(step - 1)}>{step === 0 ? "취소" : step === 2 ? "나중에 계속" : <><ArrowLeftIcon aria-hidden="true" />이전</>}</Button>
        <Button disabled={busy || (step === 1 && !name.trim())} onClick={() => { if (step === 1) runAction((issue())); else if (step === 3) onClose(); else setStep(step + 1); }}>{busy && <Spinner />}{step === 1 ? "연결 만들기" : step === 3 ? confirmed ? "완료" : "나중에 확인" : "다음"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function TokenLifetime({ value, onChange, disabled = false }: { value: AgentTokenLifetime; onChange: (value: AgentTokenLifetime) => void; disabled?: boolean }) {
  const id = useId();
  return <div className="space-y-2"><Label htmlFor={id}>토큰 유효기간</Label><Select value={value} onValueChange={(next) => { if (next) onChange(next as AgentTokenLifetime); }} disabled={disabled} items={[7, 30, 90].map((days) => ({ value: days, label: `${days}일` }))}><SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger><SelectContent>{[7, 30, 90].map((days) => <SelectItem value={days} key={days}>{days}일</SelectItem>)}</SelectContent></Select><p className="m-0 text-xs text-muted-foreground">발급 시점부터 적용됩니다. 만료되면 문서 접근이 차단되며 새 토큰으로 교체할 수 있습니다.</p></div>;
}
