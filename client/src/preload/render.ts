import { contextBridge, ipcRenderer } from "electron";
import type { AgentRenderApi } from "../foundation/agentRenderProtocol.ts";
// Keep this sandbox preload self-contained: it cannot require shared output chunks.
// Output windows cannot access document management or agent configuration IPC.
const api: AgentRenderApi = {
  snapshot: (jobId) => ipcRenderer.invoke("agent-render:snapshot", jobId),
  ready: (jobId, result) => ipcRenderer.send("agent-render:ready", jobId, result),
};
contextBridge.exposeInMainWorld("agentRender", api);
