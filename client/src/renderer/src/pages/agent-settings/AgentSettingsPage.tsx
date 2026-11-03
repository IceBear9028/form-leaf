import { useEffect, useState } from "react";
import type { AgentConnection, AgentGrants, AgentSettings } from "../../../../foundation/agentConnection.ts";
import type { DocumentSummary } from "../../../../foundation/documentLibrary.ts";
import { Button } from "@/shared/ui/button";

export function AgentSettingsPage({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState<AgentSettings>();
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [name, setName] = useState("");
  const [issued, setIssued] = useState<{ connection: AgentConnection; token: string }>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    const [settings, documents] = await Promise.all([window.documents.agentSettings(), window.documents.listDocuments()]);
    setSettings(settings); setDocuments(documents);
  };
  useEffect(() => { void refresh().catch((error) => setError(String(error))); }, []);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError(undefined);
    try { await action(); await refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  return <main className="h-full overflow-auto bg-muted/20 p-8">
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4"><Button variant="outline" onClick={onBack}>문서 목록</Button><h1 className="text-2xl font-semibold">에이전트 연결</h1></div>
      <p className="text-sm text-muted-foreground">이미 사용 중인 외부 AI 에이전트가 허용한 Formleaf 문서를 읽고 수정하도록 연결합니다. AI 로그인과 채팅은 외부 클라이언트에서 진행합니다.</p>
      {(error || settings?.error) && <p role="alert" className="rounded border border-destructive p-3 text-sm text-destructive">{error ?? settings?.error}</p>}
      <section className="space-y-3 rounded-xl border bg-background p-5" aria-label="MCP 서버">
        <div className="flex items-center justify-between"><div><h2 className="font-semibold">이 컴퓨터에서 MCP 연결 허용</h2><p className="text-sm text-muted-foreground">{settings?.running ? "연결 대기 중" : "연결 꺼짐"} · Formleaf가 실행되는 동안 사용합니다.</p></div>
          <Button disabled={busy || !settings} variant={settings?.enabled ? "outline" : "default"} onClick={() => void run(() => window.documents.agentEnable(!settings?.enabled))}>{settings?.enabled ? "연결 끄기" : "연결 켜기"}</Button></div>
        {settings && <div className="flex items-center gap-2"><code className="flex-1 rounded bg-muted p-2 text-sm">{settings.endpoint}</code><Button variant="outline" onClick={() => void run(() => navigator.clipboard.writeText(settings.endpoint))}>주소 복사</Button></div>}
      </section>
      <section className="space-y-3 rounded-xl border bg-background p-5" aria-label="새 연결">
        <h2 className="font-semibold">새 에이전트 연결</h2>
        <p className="text-sm text-muted-foreground">연결마다 별도 토큰과 문서 권한을 부여합니다. 새 연결은 읽을 수 있는 문서가 없습니다.</p>
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void run(async () => { setIssued(await window.documents.agentCreateConnection(name)); setName(""); }); }}>
          <input aria-label="연결 이름" className="min-w-0 flex-1 rounded border bg-background px-3 py-2 text-sm" maxLength={200} placeholder="예: 개인 에이전트" value={name} onChange={(event) => setName(event.target.value)} />
          <Button type="submit" disabled={busy || !name.trim()}>토큰 발급</Button>
        </form>
        {issued && <div className="space-y-2 rounded-lg border p-3" aria-label="발급된 토큰">
          <p className="text-sm">{issued.connection.name} 토큰입니다. 이 화면을 닫으면 다시 표시되지 않습니다.</p>
          <input aria-label="연결 토큰" className="w-full rounded bg-muted p-2 font-mono text-xs" readOnly value={issued.token} />
          <div className="flex gap-2"><Button variant="outline" onClick={() => void run(() => navigator.clipboard.writeText(issued.token))}>토큰 복사</Button><Button variant="outline" onClick={() => setIssued(undefined)}>토큰 숨기기</Button></div>
          <p className="text-xs text-muted-foreground">외부 클라이언트의 Streamable HTTP MCP 설정에 주소를 등록하고, Authorization 헤더에 Bearer 토큰을 지정하세요.</p>
        </div>}
      </section>
      <section className="space-y-4" aria-label="연결별 권한">
        <h2 className="font-semibold">연결별 허용 범위</h2>
        {settings?.connections.length === 0 && <p className="text-sm text-muted-foreground">아직 발급한 연결이 없습니다.</p>}
        {settings?.connections.map((connection) => <ConnectionCard key={JSON.stringify(connection)} connection={connection} documents={documents} disabled={busy} onSave={(grants) => run(() => window.documents.agentSetGrants(connection.id, grants))} onRevoke={() => run(async () => { await window.documents.agentRevoke(connection.id); if (issued?.connection.id === connection.id) setIssued(undefined); })} />)}
      </section>
      <p className="text-sm text-muted-foreground">이 권한은 Formleaf 도구 호출에 적용됩니다. 외부 에이전트가 별도로 가진 터미널·파일 접근 권한은 외부 클라이언트의 설정으로 관리해야 합니다.</p>
    </div>
  </main>;
}
function ConnectionCard({ connection, documents, disabled, onSave, onRevoke }: {
  connection: AgentConnection; documents: DocumentSummary[]; disabled: boolean;
  onSave: (grants: AgentGrants) => Promise<void>; onRevoke: () => Promise<void>;
}) {
  const [grants, setGrants] = useState(connection.grants);
  if (connection.revoked) return <div className="rounded-xl border p-4 text-sm text-muted-foreground">{connection.name} · 폐기됨</div>;
  const toggle = (key: "write" | "create" | "libraryRead" | "render", checked: boolean) => setGrants((current) => ({ ...current, [key]: checked, ...(key === "create" && checked ? { write: true } : {}), ...(key === "write" && !checked ? { create: false } : {}) }));
  return <article className="space-y-4 rounded-xl border bg-background p-5">
    <div className="flex items-center justify-between"><h3 className="font-medium">{connection.name}</h3><Button variant="outline" disabled={disabled} onClick={() => void onRevoke()}>토큰 폐기</Button></div>
    <fieldset disabled={disabled} className="space-y-2"><legend className="mb-2 text-sm font-medium">읽기를 허용할 문서</legend>
      {documents.length === 0 && <p className="text-sm text-muted-foreground">먼저 문서를 만들면 여기서 선택할 수 있습니다.</p>}
      {documents.map((document) => <label key={document.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={grants.documentIds.includes(document.id)} onChange={(event) => setGrants((current) => ({ ...current, documentIds: event.target.checked ? [...current.documentIds, document.id] : current.documentIds.filter((id) => id !== document.id) }))} />{document.name}</label>)}
    </fieldset>
    <fieldset disabled={disabled} className="grid grid-cols-2 gap-2"><legend className="mb-2 text-sm font-medium">추가 허용</legend>
      {([ ["write", "허용 문서 수정"], ["create", "새 문서 생성"], ["libraryRead", "개인 컴포넌트 라이브러리 읽기"], ["render", "미리보기와 PDF 출력"] ] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={grants[key]} onChange={(event) => toggle(key, event.target.checked)} />{label}</label>)}
    </fieldset>
    <Button disabled={disabled} onClick={() => void onSave(grants)}>권한 저장</Button>
  </article>;
}
