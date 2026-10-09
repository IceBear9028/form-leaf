import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { DocumentRepository } from "./document/documentRepository";
import { ComponentLibraryRepository } from "./document/componentLibraryRepository";
import { registerDocumentHandlers } from "./registerDocumentHandlers";
import { registerPdfHandlers } from "./registerPdfHandlers";

const legacyUserDataDirectory = join(app.getPath("appData"), "Resume Studio");
app.setName("Document");
app.setPath("userData", legacyUserDataDirectory);

let mainWindow: BrowserWindow | null = null;

function workspaceDirectory(): string {
  return join(app.getPath("userData"), "workspaces");
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1520,
    height: 980,
    minWidth: 1120,
    minHeight: 720,
    title: "Document",
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
  const workspace = workspaceDirectory();
  registerDocumentHandlers(
    new DocumentRepository(workspace),
    new ComponentLibraryRepository(workspace),
  );
  registerPdfHandlers({
    documentsDirectory: app.getPath("documents"),
    getMainWindow: () => mainWindow,
  });
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
