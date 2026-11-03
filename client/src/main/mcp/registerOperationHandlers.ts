import { dialog, ipcMain, shell, type BrowserWindow } from "electron";
import { open, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { IPC } from "../../foundation/ipc.ts";
import type { OperationHistory } from "../application/operationHistory.ts";
import type { ArtifactRepository } from "../application/artifactRepository.ts";

export function registerOperationHandlers(history: OperationHistory, artifacts: ArtifactRepository, getWindow: () => BrowserWindow | null, documentsDirectory: string): void {
  const trusted = (event: Electron.IpcMainInvokeEvent) => {
    const window = getWindow();
    if (!window || window.webContents !== event.sender) throw new Error("허용되지 않은 창입니다.");
    return window;
  };
  ipcMain.handle(IPC.agentOperations, (event) => { trusted(event); return history.recent(); });
  ipcMain.handle(IPC.agentOpenArtifact, async (event, credentialId: string, requestId: string) => {
    trusted(event); z.uuid().parse(credentialId); z.uuid().parse(requestId);
    const { metadata } = await history.artifact(credentialId, requestId);
    const path = await artifacts.verifiedFilePath(metadata.artifactId);
    // Recheck permissions after disk I/O and before handing the file to the OS.
    await history.artifact(credentialId, requestId);
    const error = await shell.openPath(path);
    if (error) throw new Error("PDF를 열지 못했습니다. 다른 위치에 저장한 뒤 열어보세요.");
  });
  ipcMain.handle(IPC.agentSaveArtifact, async (event, credentialId: string, requestId: string) => {
    const owner = trusted(event); z.uuid().parse(credentialId); z.uuid().parse(requestId);
    const { metadata } = await history.artifact(credentialId, requestId);
    const selected = await dialog.showSaveDialog(owner, { title: "에이전트 PDF 저장", defaultPath: join(documentsDirectory, metadata.filename), filters: [{ name: "PDF 문서", extensions: ["pdf"] }] });
    if (selected.canceled || !selected.filePath) return { canceled: true as const };
    const { bytes } = await history.artifact(credentialId, requestId);
    const temporary = `${selected.filePath}.${randomUUID()}.tmp`;
    let created = false;
    try {
      const file = await open(temporary, "wx", 0o600); created = true;
      try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
      await history.artifact(credentialId, requestId);
      await rename(temporary, selected.filePath);
    } finally { if (created) await unlink(temporary).catch((error) => { if (error.code !== "ENOENT") throw error; }); }
    return { canceled: false as const, filePath: selected.filePath };
  });
}
