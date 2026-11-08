import { runAction } from "@/shared/lib/async-errors";
import { useState } from "react";
import { CopyIcon } from "lucide-react";
import type { AgentClientType } from "../../../../foundation/agentConnection.ts";
import { Button } from "@/shared/ui/button";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { agentClients, copyAgentText } from "./agentConnectionUi.tsx";

export function AgentClientExamples({ endpoint, clientType = "other" }: { endpoint: string; clientType?: AgentClientType }) {
  const [type, setType] = useState<AgentClientType>(clientType);
  const config = type === "codex"
    ? `[mcp_servers.formleaf]\nurl = ${JSON.stringify(endpoint)}\nbearer_token_env_var = "FORMLEAF_MCP_TOKEN"\n`
    : type === "claude-code" ? JSON.stringify({ mcpServers: { formleaf: { type: "http", url: endpoint, headers: { Authorization: "Bearer ${FORMLEAF_MCP_TOKEN}" } } } }, null, 2)
    : `URL: ${endpoint}\nAuthorization: Bearer <Formleaf에서 발급받은 토큰>`;
  return <div className="space-y-5">
    <Select value={type} onValueChange={(value) => { if (value) setType(value as AgentClientType); }} items={Object.entries(agentClients).map(([value, item]) => ({ value, label: item.name }))}>
      <SelectTrigger className="w-full" aria-label="연결할 클라이언트"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(agentClients).map(([value, item]) => <SelectItem key={value} value={value}>{item.name}</SelectItem>)}</SelectContent>
    </Select>
    <section className="space-y-2"><h3 className="m-0 text-sm font-medium">1. CLI를 실행할 터미널에 토큰 설정</h3>
      <p className="m-0 text-xs text-muted-foreground">macOS의 zsh 기준입니다. 아래 명령을 실행한 뒤, 발급받은 토큰을 붙여넣고 Enter를 누르세요. 입력한 토큰은 화면에 표시되지 않습니다.</p>
      <CodeBlock text={'read -rs "FORMLEAF_MCP_TOKEN?Formleaf 토큰: "\necho\nexport FORMLEAF_MCP_TOKEN'} label="토큰 입력 명령 복사" />
      <p className="m-0 text-xs text-muted-foreground">새 터미널에서는 다시 설정해야 합니다. Windows 등 다른 환경에서는 동일한 환경 변수를 해당 셸의 방식으로 설정하세요.</p>
    </section>
    <section className="space-y-2"><h3 className="m-0 text-sm font-medium">2. {agentClients[type].name}에 연결 등록</h3>
      <p className="m-0 text-xs text-muted-foreground">{type === "codex" ? "Codex의 config.toml에 아래 설정을 병합하세요." : type === "claude-code" ? "작업할 폴더의 .mcp.json에 아래 설정을 병합하세요. 프로젝트 MCP 승인 안내가 나오면 확인하세요." : "클라이언트의 HTTP MCP 연결 설정에 주소와 인증 정보를 입력하세요."}</p>
      <CodeBlock text={config} label={`${agentClients[type].name} 설정 복사`} />
      {type !== "other" && <a className="text-xs text-muted-foreground underline underline-offset-4" href={type === "codex" ? "https://developers.openai.com/codex/mcp" : "https://code.claude.com/docs/en/mcp"} target="_blank" rel="noreferrer">공식 연결 문서</a>}
    </section>
    <section className="space-y-2"><h3 className="m-0 text-sm font-medium">3. 에이전트 실행 후 첫 요청</h3>
      <p className="m-0 text-xs text-muted-foreground">{type === "other" ? "클라이언트를 실행하고 첫 요청을 보내세요." : `토큰을 설정한 같은 터미널에서 ${type === "codex" ? "codex" : "claude"}를 실행하세요. AI 계정 로그인 안내가 나오면 해당 도구에서 진행하세요.`}</p>
      <CodeBlock text="Formleaf 도구로 접근 가능한 문서 목록을 보여줘." label="첫 요청 문장 복사" />
    </section>
    <Alert role="note"><AlertDescription>Formleaf를 계속 실행해 두세요. 이 안내는 문서 도구 연결용이며 AI 계정 로그인이나 CLI 실행을 대신하지 않습니다.</AlertDescription></Alert>
  </div>;
}
function CodeBlock({ text, label }: { text: string; label: string }) {
  return <div className="min-w-0 rounded-lg border border-border bg-muted/40"><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs leading-relaxed">{text}</pre><div className="flex justify-end border-t border-border px-2 py-1"><Button variant="ghost" size="sm" onClick={() => runAction((copyAgentText(text, "복사했습니다.")))}><CopyIcon aria-hidden="true" />{label}</Button></div></div>;
}
