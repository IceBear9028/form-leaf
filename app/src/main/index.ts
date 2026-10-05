import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { IPC } from "../shared/ipc";
import {
  createDefaultDocument,
  isResumeDocument,
  isV1ResumeDocument,
  type ResumeDocument,
} from "../shared/resume";
import { migrateResumeDocumentV1 } from "../shared/resumeMigration";

app.setName("Resume Studio");

let mainWindow: BrowserWindow | null = null;
let saveQueue: Promise<{ savedAt: string }> = Promise.resolve({ savedAt: "" });

function workspaceDirectory(): string {
  return join(app.getPath("userData"), "workspaces");
}

function documentPath(): string {
  return join(workspaceDirectory(), "default.resume.json");
}

async function loadDocument(): Promise<ResumeDocument> {
  const path = documentPath();
  if (!existsSync(path)) return createDefaultDocument();

  try {
    const raw = await readFile(path, "utf8");
    const document: unknown = JSON.parse(raw);
    return normalizeStoredDocument(document);
  } catch (error) {
    const backupPath = `${path}.backup`;
    if (!existsSync(backupPath)) throw error;
    const raw = await readFile(backupPath, "utf8");
    const backup: unknown = JSON.parse(raw);
    try {
      return normalizeStoredDocument(backup);
    } catch {
      throw error;
    }
  }
}

function normalizeStoredDocument(value: unknown): ResumeDocument {
  if (isResumeDocument(value)) return value;
  if (isV1ResumeDocument(value)) return migrateResumeDocumentV1(value);
  throw new Error("저장된 이력서의 데이터 형식이 올바르지 않습니다.");
}

async function saveDocument(document: ResumeDocument): Promise<{ savedAt: string }> {
  if (!isResumeDocument(document)) {
    throw new Error("저장할 이력서의 데이터 형식이 올바르지 않습니다.");
  }

  const directory = workspaceDirectory();
  const path = documentPath();
  const temporaryPath = `${path}.tmp`;
  const savedAt = new Date().toISOString();
  const nextDocument = { ...document, updatedAt: savedAt };

  await mkdir(directory, { recursive: true });
  if (existsSync(path)) {
    try {
      const current: unknown = JSON.parse(await readFile(path, "utf8"));
      if (isResumeDocument(current)) {
        await copyFile(path, `${path}.backup`);
      } else if (isV1ResumeDocument(current)) {
        const v1BackupPath = `${path}.v1.backup`;
        if (!existsSync(v1BackupPath)) await copyFile(path, v1BackupPath);
      }
    } catch {
      // 손상된 현재 파일로 직전 정상 백업을 덮어쓰지 않는다.
    }
  }
  await writeFile(temporaryPath, `${JSON.stringify(nextDocument, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
  return { savedAt };
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

function registerIpcHandlers(): void {
  ipcMain.handle(IPC.loadDocument, () => loadDocument());
  ipcMain.handle(IPC.saveDocument, (_event, document: ResumeDocument) => {
    saveQueue = saveQueue.then(
      () => saveDocument(document),
      () => saveDocument(document),
    );
    return saveQueue;
  });
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
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
