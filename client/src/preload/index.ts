import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "../foundation/ipc";
import type { ResumeDocument } from "../foundation/resume";
import type { ResumeStudioApi } from "../foundation/resumeLibrary";

const api: ResumeStudioApi = {
  listResumes: () => ipcRenderer.invoke(IPC.listResumes),
  listDeletedResumes: () => ipcRenderer.invoke(IPC.listDeletedResumes),
  createResume: () => ipcRenderer.invoke(IPC.createResume),
  loadResume: (id: string) => ipcRenderer.invoke(IPC.loadResume, id),
  saveResume: (id: string, document: ResumeDocument) =>
    ipcRenderer.invoke(IPC.saveResume, id, document),
  renameResume: (id: string, title: string) =>
    ipcRenderer.invoke(IPC.renameResume, id, title),
  deleteResume: (id: string) => ipcRenderer.invoke(IPC.deleteResume, id),
  restoreResume: (id: string) => ipcRenderer.invoke(IPC.restoreResume, id),
  permanentlyDeleteResume: (id: string) =>
    ipcRenderer.invoke(IPC.permanentlyDeleteResume, id),
  exportPdf: (suggestedName: string) =>
    ipcRenderer.invoke(IPC.exportPdf, suggestedName),
  showInFolder: (filePath: string) =>
    ipcRenderer.invoke(IPC.showInFolder, filePath),
};

contextBridge.exposeInMainWorld("resumeStudio", api);
