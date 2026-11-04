import { CommandIcon, SparklesIcon, PlugIcon } from "lucide-react";
import type { AgentClientType, AgentConnection, AgentSettings } from "../../../../foundation/agentConnection.ts";
import { Badge } from "@/shared/ui/badge";
import { toast } from "@/shared/ui/toast";

export const agentClients = {
  codex: { name: "Codex", description: "Codex CLI에서 문서를 읽고 수정합니다.", icon: CommandIcon },
  "claude-code": { name: "Claude Code", description: "Claude Code에서 문서 작업을 이어갑니다.", icon: SparklesIcon },
  other: { name: "기타 MCP 클라이언트", description: "MCP를 지원하는 도구에 직접 연결합니다.", icon: PlugIcon },
} satisfies Record<AgentClientType, { name: string; description: string; icon: typeof PlugIcon }>;
export function AgentIcon({ type = "other" }: { type?: AgentClientType }) {
  const Icon = agentClients[type].icon;
  return <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground"><Icon className="size-5" aria-hidden="true" /></span>;
}
export function tokenExpired(connection: AgentConnection): boolean {
  return !!connection.expiresAt && Date.parse(connection.expiresAt) <= Date.now();
}
export function ConnectionStatus({ connection, settings }: { connection: AgentConnection; settings: AgentSettings }) {
  const expired = tokenExpired(connection);
  const text = connection.revoked ? "접근 해제됨" : expired ? "토큰 만료" : !settings.running ? "서버 꺼짐" : connection.lastUsedAt ? "인증 요청 확인" : "요청 대기";
  return <Badge variant={expired || connection.revoked ? "outline" : connection.lastUsedAt && settings.running ? "secondary" : "outline"}>{text}</Badge>;
}
export function formatAgentDate(value?: string): string {
  return value ? new Date(value).toLocaleString("ko-KR", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "아직 없음";
}
export async function copyAgentText(text: string, title: string): Promise<void> {
  try { await navigator.clipboard.writeText(text); toast.add({ type: "success", title }); }
  catch { toast.add({ type: "error", title: "복사하지 못했습니다.", description: "내용을 직접 선택해 복사해 주세요." }); }
}
