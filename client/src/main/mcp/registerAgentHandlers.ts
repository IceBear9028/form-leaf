import { ipcMain } from "electron";
import { IPC } from "../../foundation/ipc.ts";
import type { AccessPolicy, Grants } from "./accessPolicy.ts";
import type { AgentServer } from "./server.ts";
import type { DocumentService } from "../application/documentService.ts";

export function registerAgentHandlers(policy: AccessPolicy, server: AgentServer, service: DocumentService): void {
  ipcMain.handle(IPC.agentSettings, () => ({ ...policy.settings(), ...server.status() }));
  ipcMain.handle(IPC.agentEnable, async (_event, enabled: boolean) => {
    await policy.setEnabled(enabled);
    if (enabled) {
      try { await server.start(); } catch { await policy.setEnabled(false); }
    } else await server.stop();
    return { ...policy.settings(), ...server.status() };
  });
  ipcMain.handle(IPC.agentCreateConnection, (_event, name: string) => policy.create(name));
  ipcMain.handle(IPC.agentSetGrants, async (_event, id: string, grants: Grants) => {
    const documents = await service.list();
    if (grants.documentIds.some((documentId) => !documents.some((item) => item.id === documentId))) throw new Error("허용할 문서를 목록에서 찾을 수 없습니다.");
    await policy.setGrants(id, grants);
  });
  ipcMain.handle(IPC.agentRevoke, (_event, id: string) => policy.revoke(id));
}
