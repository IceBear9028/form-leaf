import { ipcMain } from "electron";
import { IPC } from "../../foundation/ipc.ts";
import type { AccessPolicy, Grants } from "./accessPolicy.ts";
import { connectionOptionsSchema, grantSchema, tokenLifetimeSchema } from "./accessPolicy.ts";
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
  const validateDocuments = async (grants: Grants) => {
    const documents = await service.list();
    if (grants.documentIds.some((documentId) => !documents.some((item) => item.id === documentId))) throw new Error("허용할 문서를 목록에서 찾을 수 없습니다.");
  };
  ipcMain.handle(IPC.agentCreateConnection, async (_event, name: string, options: unknown) => {
    const parsed = options === undefined ? undefined : connectionOptionsSchema.parse(options);
    if (parsed) await validateDocuments(parsed.grants);
    return policy.create(name, parsed);
  });
  ipcMain.handle(IPC.agentRotateToken, (_event, id: string, days: unknown) => policy.rotate(id, tokenLifetimeSchema.parse(days)));
  ipcMain.handle(IPC.agentSetGrants, async (_event, id: string, grants: Grants) => {
    const parsed = grantSchema.parse(grants);
    await validateDocuments(parsed);
    await policy.setGrants(id, parsed);
  });
  ipcMain.handle(IPC.agentRevoke, (_event, id: string) => policy.revoke(id));
}
