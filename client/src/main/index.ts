import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "node:path";
import { DocumentRepository } from "./document/documentRepository";
import { ComponentLibraryRepository } from "./document/componentLibraryRepository";
import { registerDocumentHandlers } from "./registerDocumentHandlers";
import { registerPdfHandlers } from "./registerPdfHandlers";
import { IPC } from "../foundation/ipc";
import { LEGACY_APP_DIRECTORY_NAME } from "./document/legacy/legacyPaths";

const legacyUserDataDirectory = process.env.DOCUMENT_USER_DATA_DIRECTORY ??
  join(app.getPath("appData"), LEGACY_APP_DIRECTORY_NAME);
app.setName("Formleaf");
app.setPath("userData", legacyUserDataDirectory);

let mainWindow: BrowserWindow | null = null;
let closeGuard = false;
let closePending = false;
let closeApproved = false;
let quitRequested = false;
app.on("before-quit", () => { quitRequested = true; });
ipcMain.on(IPC.closeGuard, (event, enabled: boolean) => {
  if (event.sender !== mainWindow?.webContents) return;
  closeGuard = enabled;
});
ipcMain.on(IPC.completeClose, (event, saved: boolean) => {
  if (event.sender !== mainWindow?.webContents || !closePending) return;
  closePending = false;
  if (!saved) { quitRequested = false; return; }
  closeApproved = true;
  mainWindow.close();
});
const interactionDebugEnabled = process.env.DOCUMENT_INTERACTION_DEBUG === "1";
const headlessE2eEnabled = process.env.DOCUMENT_E2E_HEADLESS === "1";
const editorOwnershipSpikeEnabled = process.env.DOCUMENT_EDITOR_OWNERSHIP_SPIKE === "1";

function workspaceDirectory(): string {
  return join(app.getPath("userData"), "workspaces");
}

function createWindow(): void {
  if (mainWindow) return;
  mainWindow = new BrowserWindow({
    width: 1520,
    height: 980,
    minWidth: 1120,
    minHeight: 720,
    title: "Formleaf",
    backgroundColor: "#eef1f5",
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (!headlessE2eEnabled) mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("close", (event) => {
    if (!closeGuard || closeApproved) return;
    event.preventDefault();
    if (closePending) return;
    closePending = true;
    mainWindow?.webContents.send(IPC.requestClose);
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
    closeGuard = closePending = closeApproved = false;
    if (quitRequested) app.quit();
  });
  if (interactionDebugEnabled) {
    mainWindow.webContents.on("console-message", (_event, _level, message) => {
      if (message.startsWith("[Formleaf debug]")) console.log(message);
    });
  }
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
    const rendererUrl = new URL(process.env.ELECTRON_RENDERER_URL);
    if (interactionDebugEnabled) rendererUrl.searchParams.set("interactionDebug", "1");
    if (editorOwnershipSpikeEnabled) rendererUrl.searchParams.set("editorOwnershipSpike", "1");
    void mainWindow.loadURL(rendererUrl.toString());
  } else {
    const query = {
      ...(interactionDebugEnabled ? { interactionDebug: "1" } : {}),
      ...(editorOwnershipSpikeEnabled ? { editorOwnershipSpike: "1" } : {}),
    };
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"), {
      query: Object.keys(query).length ? query : undefined,
    });
  }
}

app.whenReady().then(() => {
  const workspace = workspaceDirectory();
  const documents = new DocumentRepository(workspace);
  const components = new ComponentLibraryRepository(workspace);
  registerDocumentHandlers(
    documents,
    components,
  );
  registerPdfHandlers({
    documentsDirectory: app.getPath("documents"),
    getMainWindow: () => mainWindow,
  });
  void Promise.allSettled([
    documents.initialize(),
    components.initialize(),
  ]).then(createWindow);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
