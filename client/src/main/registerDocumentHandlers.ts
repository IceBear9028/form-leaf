import { ipcMain } from "electron";
import type { WorkspaceDocument } from "../foundation/document";
import { IPC } from "../foundation/ipc";
import type { DocumentRepository } from "./document/documentRepository";

export function registerDocumentHandlers(repository: DocumentRepository): void {
  ipcMain.handle(IPC.listDocuments, () => repository.list());
  ipcMain.handle(IPC.listDeletedDocuments, () => repository.listTrash());
  ipcMain.handle(IPC.createDocument, () => repository.create());
  ipcMain.handle(IPC.loadDocument, (_event, id: string) => repository.load(id));
  ipcMain.handle(IPC.saveDocument, (_event, id: string, document: WorkspaceDocument) =>
    repository.save(id, document));
  ipcMain.handle(IPC.renameDocument, (_event, id: string, title: string) =>
    repository.rename(id, title));
  ipcMain.handle(IPC.deleteDocument, (_event, id: string) => repository.remove(id));
  ipcMain.handle(IPC.restoreDocument, (_event, id: string) => repository.restore(id));
  ipcMain.handle(IPC.permanentlyDeleteDocument, (_event, id: string) =>
    repository.permanentlyDelete(id));
}
