import { useState } from "react";
import { Button } from "@/shared/ui/button";

export function AgentClientExamples({ endpoint }: { endpoint: string }) {
  const [notice, setNotice] = useState<string>();
  const examples = [
    { name: "Codex", file: "config.toml", source: "https://developers.openai.com/codex/mcp", value: `[mcp_servers.formleaf]\nurl = ${JSON.stringify(endpoint)}\nbearer_token_env_var = "FORMLEAF_MCP_TOKEN"\n` },
    { name: "Claude Code", file: ".mcp.json", source: "https://code.claude.com/docs/en/mcp", value: JSON.stringify({ mcpServers: { formleaf: { type: "http", url: endpoint, headers: { Authorization: "Bearer ${FORMLEAF_MCP_TOKEN}" } } } }, null, 2) },
  ];
  return <details className="space-y-3 rounded-xl border bg-background p-5">
    <summary className="cursor-pointer font-semibold">외부 에이전트 연결 방법</summary>
    <ol className="list-decimal space-y-2 pl-5 text-sm"><li>Formleaf에서 연결을 켜고 토큰과 허용 문서를 설정하세요.</li><li>외부 에이전트를 실행하는 환경에 FORMLEAF_MCP_TOKEN 값을 발급받은 Formleaf 토큰으로 설정하세요.</li><li>아래 예시를 기존 클라이언트 설정에 병합하고 연결 상태를 확인하세요. 같은 컴퓨터에서 Formleaf를 실행해 두세요.</li></ol>
    <p className="text-sm text-muted-foreground">복사하는 예시에 실제 토큰은 포함되지 않습니다. AI 계정 로그인은 각 클라이언트에서 진행합니다.</p>
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {examples.map((example) => <div key={example.name} className="space-y-2"><div className="flex items-center justify-between"><h3 className="text-sm font-medium">{example.name} · {example.file}</h3><Button variant="outline" onClick={() => void navigator.clipboard.writeText(example.value).then(() => setNotice(`${example.name} 설정 예시를 복사했습니다.`), () => setNotice("클립보드에 복사하지 못했습니다. 예시를 직접 선택해 복사하세요."))}>{example.name} 설정 복사</Button></div><pre className="overflow-auto rounded bg-muted p-3 text-xs">{example.value}</pre><a className="text-xs underline" href={example.source} target="_blank" rel="noreferrer">공식 연결 문서</a></div>)}
  </details>;
}
