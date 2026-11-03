import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "../foundation/ipc";
import type { DocumentData } from "../foundation/document";
import type { ComponentLibraryPackageInput } from "../foundation/componentLibrary";
import type { DocumentApi } from "../foundation/documentLibrary";

const api: DocumentApi = {
  agentSettings: () => ipcRenderer.invoke(IPC.agentSettings),
  agentEnable: (enabled) => ipcRenderer.invoke(IPC.agentEnable, enabled),
  agentCreateConnection: (name) => ipcRenderer.invoke(IPC.agentCreateConnection, name),
  agentSetGrants: (id, grants) => ipcRenderer.invoke(IPC.agentSetGrants, id, grants),
  agentRevoke: (id) => ipcRenderer.invoke(IPC.agentRevoke, id),
  onBeforeClose: (handler) => {
    const listener = () => { void handler().then(
      (saved) => ipcRenderer.send(IPC.completeClose, saved),
      () => ipcRenderer.send(IPC.completeClose, false),
    ); };
    ipcRenderer.on(IPC.requestClose, listener);
    ipcRenderer.send(IPC.closeGuard, true);
    return () => {
      ipcRenderer.removeListener(IPC.requestClose, listener);
      ipcRenderer.send(IPC.closeGuard, false);
    };
  },
  onEditorRequest: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, request: Parameters<typeof handler>[0]) => {
      try { ipcRenderer.send(IPC.editorReply, handler(request)); }
      catch { ipcRenderer.send(IPC.editorReply, { requestId: request.requestId, ok: false, context: null }); }
    };
    ipcRenderer.on(IPC.editorRequest, listener);
    return () => ipcRenderer.removeListener(IPC.editorRequest, listener);
  },
  reportEditorContext: (context) => ipcRenderer.send(IPC.editorContext, context),
  listDocuments: () => ipcRenderer.invoke(IPC.listDocuments),
  listDeletedDocuments: () => ipcRenderer.invoke(IPC.listDeletedDocuments),
  createDocument: () => ipcRenderer.invoke(IPC.createDocument),
  loadDocument: (id: string) => ipcRenderer.invoke(IPC.loadDocument, id),
  saveDocument: (id: string, document: DocumentData, expectedRevision: string) =>
    ipcRenderer.invoke(IPC.saveDocument, id, document, expectedRevision),
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
