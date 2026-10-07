import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { IPC } from "../shared/ipc";
import type { ResumeDocument } from "../shared/resume";
import { ResumeRepository } from "./resumeRepository";

app.setName("Resume Studio");

let mainWindow: BrowserWindow | null = null;

function workspaceDirectory(): string {
  return join(app.getPath("userData"), "workspaces");
}

function safePdfName(name: string): string {
  const normalized = name.trim().replace(/[\\/:*?"<>|]/g, "-");
  return `${normalized || "resume"}.pdf`;
}

async function exportPdf(sender: Electron.WebContents, name: string) {
  const owner = BrowserWindow.fromWebContents(sender) ?? mainWindow;
  const options: Electron.SaveDialogOptions = {
    title: "이력서 PDF 내보내기",
    defaultPath: join(app.getPath("documents"), safePdfName(name)),
    filters: [{ name: "PDF 문서", extensions: ["pdf"] }],
  };
  const result = owner
    ? await dialog.showSaveDialog(owner, options)
    : await dialog.showSaveDialog(options);

  if (result.canceled || !result.filePath) return { canceled: true as const };

  const pdf = await sender.printToPDF({
    pageSize: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false,
    scale: 1,
  });
  const temporaryPath = `${result.filePath}.tmp`;
  await writeFile(temporaryPath, pdf);
  await rename(temporaryPath, result.filePath);
  return { canceled: false as const, filePath: result.filePath };
}

function registerIpcHandlers(repository: ResumeRepository): void {
  ipcMain.handle(IPC.listResumes, () => repository.list());
  ipcMain.handle(IPC.listDeletedResumes, () => repository.listTrash());
  ipcMain.handle(IPC.createResume, () => repository.create());
  ipcMain.handle(IPC.loadResume, (_event, id: string) => repository.load(id));
  ipcMain.handle(IPC.saveResume, (_event, id: string, document: ResumeDocument) =>
    repository.save(id, document));
  ipcMain.handle(IPC.renameResume, (_event, id: string, title: string) =>
    repository.rename(id, title));
  ipcMain.handle(IPC.deleteResume, (_event, id: string) => repository.remove(id));
  ipcMain.handle(IPC.restoreResume, (_event, id: string) => repository.restore(id));
  ipcMain.handle(IPC.permanentlyDeleteResume, (_event, id: string) =>
    repository.permanentlyDelete(id));
  ipcMain.handle(IPC.exportPdf, (event, name: string) =>
    exportPdf(event.sender, name),
  );
  ipcMain.handle(IPC.showInFolder, (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1520,
    height: 980,
    minWidth: 1120,
    minHeight: 720,
    title: "Resume Studio",
    backgroundColor: "#eef1f5",
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:|mailto:)/.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const currentUrl = mainWindow?.webContents.getURL();
    if (url === currentUrl) return;
    event.preventDefault();
    if (/^(https?:|mailto:)/.test(url)) void shell.openExternal(url);
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  registerIpcHandlers(new ResumeRepository(workspaceDirectory()));
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
