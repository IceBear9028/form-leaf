import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { DocumentRepository } from "./document/documentRepository";
import { ComponentLibraryRepository } from "./document/componentLibraryRepository";
import { registerDocumentHandlers } from "./registerDocumentHandlers";
import { registerPdfHandlers } from "./registerPdfHandlers";
import { LEGACY_APP_DIRECTORY_NAME } from "./document/legacy/legacyPaths";

const legacyUserDataDirectory = process.env.DOCUMENT_USER_DATA_DIRECTORY ??
  join(app.getPath("appData"), LEGACY_APP_DIRECTORY_NAME);
app.setName("Document");
app.setPath("userData", legacyUserDataDirectory);

let mainWindow: BrowserWindow | null = null;
const interactionDebugEnabled = process.env.DOCUMENT_INTERACTION_DEBUG === "1";
const headlessE2eEnabled = process.env.DOCUMENT_E2E_HEADLESS === "1";

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

  if (!headlessE2eEnabled) mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  if (interactionDebugEnabled) {
    mainWindow.webContents.on("console-message", (_event, _level, message) => {
      if (message.startsWith("[Resume Studio debug]")) console.log(message);
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
    void mainWindow.loadURL(rendererUrl.toString());
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"), {
      query: interactionDebugEnabled ? { interactionDebug: "1" } : undefined,
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
