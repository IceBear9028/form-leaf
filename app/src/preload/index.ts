import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "../shared/ipc";
import type { ResumeDocument, ResumeStudioApi } from "../shared/resume";

const api: ResumeStudioApi = {
  loadDocument: () => ipcRenderer.invoke(IPC.loadDocument),
  saveDocument: (document: ResumeDocument) =>
    ipcRenderer.invoke(IPC.saveDocument, document),
  exportPdf: (suggestedName: string) =>
    ipcRenderer.invoke(IPC.exportPdf, suggestedName),
  showInFolder: (filePath: string) =>
    ipcRenderer.invoke(IPC.showInFolder, filePath),
};

contextBridge.exposeInMainWorld("resumeStudio", api);
