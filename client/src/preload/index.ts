import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "../foundation/ipc";
import type { DocumentData } from "../foundation/document";
import type { ComponentLibraryPackageInput } from "../foundation/componentLibrary";
import type { DocumentApi } from "../foundation/documentLibrary";

const api: DocumentApi = {
  listDocuments: () => ipcRenderer.invoke(IPC.listDocuments),
  listDeletedDocuments: () => ipcRenderer.invoke(IPC.listDeletedDocuments),
  createDocument: () => ipcRenderer.invoke(IPC.createDocument),
  loadDocument: (id: string) => ipcRenderer.invoke(IPC.loadDocument, id),
  saveDocument: (id: string, document: DocumentData) =>
    ipcRenderer.invoke(IPC.saveDocument, id, document),
  renameDocument: (id: string, title: string) =>
    ipcRenderer.invoke(IPC.renameDocument, id, title),
  deleteDocument: (id: string) => ipcRenderer.invoke(IPC.deleteDocument, id),
  restoreDocument: (id: string) => ipcRenderer.invoke(IPC.restoreDocument, id),
  permanentlyDeleteDocument: (id: string) =>
    ipcRenderer.invoke(IPC.permanentlyDeleteDocument, id),
  listComponents: () => ipcRenderer.invoke(IPC.listComponents),
  saveComponent: (input: ComponentLibraryPackageInput) =>
    ipcRenderer.invoke(IPC.saveComponent, input),
  loadComponent: (id: string) => ipcRenderer.invoke(IPC.loadComponent, id),
  deleteComponent: (id: string) => ipcRenderer.invoke(IPC.deleteComponent, id),
  exportPdf: (suggestedName: string) =>
    ipcRenderer.invoke(IPC.exportPdf, suggestedName),
  showInFolder: (filePath: string) =>
    ipcRenderer.invoke(IPC.showInFolder, filePath),
};

contextBridge.exposeInMainWorld("documents", api);
