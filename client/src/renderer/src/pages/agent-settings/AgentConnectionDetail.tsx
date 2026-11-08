import { runAction } from "@/shared/lib/async-errors";
import { useEffect, useState } from "react";
import type { AgentConnection, AgentGrants, AgentSettings } from "../../../../foundation/agentConnection.ts";
import type { DocumentSummary } from "../../../../foundation/documentLibrary.ts";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { AgentGrantFields } from "./AgentGrantFields.tsx";
import { AgentOperations } from "./AgentOperations.tsx";
import { AgentIcon, ConnectionStatus, formatAgentDate, tokenExpired } from "./agentConnectionUi.tsx";

export function AgentConnectionDetail({ connection, settings, documents, busy, onSave, onDirtyChange, onSetup, onRotate, onRevoke }: {
  connection: AgentConnection; settings: AgentSettings; documents: DocumentSummary[]; busy: boolean;
  onSave: (grants: AgentGrants) => Promise<boolean>; onDirtyChange: (dirty: boolean) => void;
  onSetup: () => void; onRotate: () => void; onRevoke: () => void;
}) {
  return <Card className="min-w-0 gap-0 py-0" role="region" aria-label="선택한 연결 상세">
    <CardHeader className="flex flex-row items-center justify-between gap-3 py-5"><div className="flex min-w-0 items-center gap-3"><AgentIcon type={connection.clientType} /><div className="min-w-0"><h2 className="m-0 break-words text-lg font-medium">{connection.name}</h2><p className="m-0 mt-1 text-xs text-muted-foreground">이 연결의 문서 접근을 관리합니다.</p></div></div><ConnectionStatus connection={connection} settings={settings} /></CardHeader>
    <Tabs defaultValue="permissions">
      <TabsList className="mx-6" aria-label="연결 상세"><TabsTrigger value="permissions">문서와 권한</TabsTrigger><TabsTrigger value="security">연결 · 보안</TabsTrigger><TabsTrigger value="activity">작업 기록</TabsTrigger></TabsList>
      <TabsContent value="permissions" keepMounted><GrantEditor key={connection.id} connection={connection} documents={documents} busy={busy} onSave={onSave} onDirtyChange={onDirtyChange} /></TabsContent>
      <TabsContent value="security"><CardContent className="gap-5 py-6">
        <Alert role="note"><AlertDescription>{connection.revoked ? "접근이 해제된 연결입니다. 기존 토큰은 더 이상 사용할 수 없습니다." : tokenExpired(connection) ? "토큰이 만료되어 접근이 차단됐습니다. 새 토큰으로 교체한 뒤 CLI 설정을 업데이트하세요." : connection.lastUsedAt ? "현재 토큰으로 인증된 요청을 받았습니다. CLI 실행 여부와 AI 계정 로그인 상태를 뜻하지는 않습니다." : "이번 앱 실행에서 현재 토큰의 인증 요청이 아직 확인되지 않았습니다."}</AlertDescription></Alert>
        <dl className="m-0 divide-y divide-border text-sm">{[
          ["연결 생성일", formatAgentDate(connection.createdAt)],
          ["토큰 발급일", formatAgentDate(connection.tokenCreatedAt ?? connection.createdAt)],
          ["토큰 만료일", connection.expiresAt ? formatAgentDate(connection.expiresAt) : "기존 토큰 · 만료 없음"],
          ["최근 인증 요청 (이번 실행)", formatAgentDate(connection.lastUsedAt)],
        ].map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-muted-foreground">{label}</dt><dd className="m-0">{value}</dd></div>)}</dl>
        <div className="space-y-2"><h3 className="m-0 text-sm font-medium">연결 토큰</h3><div className="rounded-lg border border-border bg-muted/30 p-3 font-mono text-sm" aria-label="저장된 토큰은 표시하지 않음">•••• •••• •••• ••••</div><p className="m-0 text-xs text-muted-foreground">원문은 발급·교체 직후에만 표시합니다.</p></div>
        {!connection.revoked && <><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={onSetup} disabled={busy}>연결 설정 보기</Button><Button variant="outline" onClick={onRotate} disabled={busy}>토큰 교체</Button></div><div className="border-t border-border pt-4"><Button variant="ghost" className="text-destructive" disabled={busy} onClick={onRevoke}>이 연결의 접근 해제</Button></div></>}
      </CardContent></TabsContent>
      <TabsContent value="activity"><CardContent className="py-6"><AgentOperations credentialId={connection.id} embedded /></CardContent></TabsContent>
    </Tabs>
  </Card>;
}

export function GrantEditor({ connection, documents, busy, onSave, onDirtyChange }: {
  connection: AgentConnection; documents: DocumentSummary[]; busy: boolean;
  onSave: (grants: AgentGrants) => Promise<boolean>; onDirtyChange: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(connection.grants);
  const [baseline, setBaseline] = useState(connection.grants);
  const grants = connection.grants;
  const remote = JSON.stringify(grants);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const stale = remote !== JSON.stringify(baseline);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty || connection.revoked) {
      setDraft(current => sameGrants(current, grants) ? current : grants);
      setBaseline(current => sameGrants(current, grants) ? current : grants);
    }
  }, [grants, dirty, connection.revoked]); // Polling must not replace an unsaved draft.
  const reset = () => { setDraft(connection.grants); setBaseline(connection.grants); };
  return <div>
    <CardContent className="py-6">
      {connection.revoked && <Alert role="note"><AlertDescription>접근이 해제된 연결의 권한은 변경할 수 없습니다.</AlertDescription></Alert>}
      {stale && dirty && <Alert><AlertDescription>서버의 권한이 변경됐습니다. 최신 권한을 불러온 뒤 다시 편집해 주세요.</AlertDescription><Button variant="outline" size="sm" onClick={reset}>최신 권한 불러오기</Button></Alert>}
      <AgentGrantFields value={draft} onChange={setDraft} documents={documents} disabled={busy || connection.revoked} />
    </CardContent>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4"><p className="m-0 text-xs text-muted-foreground">{dirty ? "저장하지 않은 변경사항이 있습니다." : "저장된 권한입니다."}</p><div className="flex gap-2">{dirty && <Button variant="ghost" disabled={busy} onClick={reset}>변경 취소</Button>}<Button disabled={busy || connection.revoked || !dirty || stale} onClick={() => runAction((onSave(draft).then((saved) => { if (saved) { setBaseline(draft); onDirtyChange(false); } })))}>권한 저장</Button></div></div>
  </div>;
}

function sameGrants(left: AgentGrants, right: AgentGrants): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
