import { editorContextSchema, editorReplySchema } from "../foundation/documentSessionProtocol.ts";
import { RenderService } from "./application/renderService.ts";
import { OutputService } from "./application/outputService.ts";
import { ArtifactRepository } from "./application/artifactRepository.ts";
import { OperationHistory } from "./application/operationHistory.ts";
import { registerOperationHandlers } from "./mcp/registerOperationHandlers.ts";
import { AccessPolicy } from "./mcp/accessPolicy.ts";
import { AgentServer } from "./mcp/server.ts";
import { createAgentProtocol } from "./mcp/tools.ts";
import { registerAgentHandlers } from "./mcp/registerAgentHandlers.ts";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "node:path";
import { DocumentService } from "./application/documentService.ts";
import { EditorCoordinator } from "./application/editorCoordinator.ts";
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

const ownsWorkspace = app.requestSingleInstanceLock();
if (!ownsWorkspace) app.quit();
const editorCoordinator = new EditorCoordinator();
ipcMain.on(IPC.editorContext, (event, context: unknown) => {
  const parsed = editorContextSchema.nullable().safeParse(context);
  if (event.sender === mainWindow?.webContents && parsed.success) editorCoordinator.update(parsed.data);
});
ipcMain.on(IPC.editorReply, (event, reply: unknown) => {
  const parsed = editorReplySchema.safeParse(reply);
  if (event.sender === mainWindow?.webContents && parsed.success) editorCoordinator.reply(parsed.data);
});
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

  editorCoordinator.attach((request) => mainWindow?.webContents.send(IPC.editorRequest, request));
  if (!headlessE2eEnabled) mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("close", (event) => {
    if (!closeGuard || closeApproved) return;
    event.preventDefault();
    if (closePending) return;
    closePending = true;
    mainWindow?.webContents.send(IPC.requestClose);
  });
  mainWindow.on("closed", () => {
    editorCoordinator.detach();
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
    if (/^(https?:|mailto:)/.test(url)) shell.openExternal(url).catch((error: unknown) => console.error("External URL failed", error));
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const currentUrl = mainWindow?.webContents.getURL();
    if (url === currentUrl) return;
    event.preventDefault();
    if (/^(https?:|mailto:)/.test(url)) shell.openExternal(url).catch((error: unknown) => console.error("External URL failed", error));
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    const rendererUrl = new URL(process.env.ELECTRON_RENDERER_URL);
    if (interactionDebugEnabled) rendererUrl.searchParams.set("interactionDebug", "1");
    if (editorOwnershipSpikeEnabled) rendererUrl.searchParams.set("editorOwnershipSpike", "1");
    mainWindow.loadURL(rendererUrl.toString()).catch((error: unknown) => { console.error("Renderer load failed", error); app.quit(); });
  } else {
    const query = {
      ...(interactionDebugEnabled ? { interactionDebug: "1" } : {}),
      ...(editorOwnershipSpikeEnabled ? { editorOwnershipSpike: "1" } : {}),
    };
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"), {
      query: Object.keys(query).length ? query : undefined,
    }).catch((error: unknown) => { console.error("Renderer load failed", error); app.quit(); });
  }
}

app.whenReady().then(() => {
  if (!ownsWorkspace) return;
  const workspace = workspaceDirectory();
  const documents = new DocumentRepository(workspace);
  const components = new ComponentLibraryRepository(workspace);
  const service = new DocumentService(documents, components, workspace, { coordinator: editorCoordinator, onCommitted: () => mainWindow?.webContents.send(IPC.libraryChanged) });
  const policy = new AccessPolicy(workspace);
  service.setCreatedGrantHandler((credentialId, documentId) => policy.grantCreated(credentialId, documentId));
  const renderer = new RenderService(join(__dirname, "../renderer"), join(__dirname, "../preload/render.js"));
  const artifacts = new ArtifactRepository(workspace);
  const outputs = new OutputService(service, policy, renderer, artifacts);
  const agentServer = new AgentServer(policy, (id) => createAgentProtocol(policy, service, id, app.getVersion(), outputs));
  registerAgentHandlers(policy, agentServer, service);
  registerOperationHandlers(new OperationHistory(service, policy, outputs), artifacts, () => mainWindow, app.getPath("documents"));
  registerDocumentHandlers(service);
  registerPdfHandlers({
    documentsDirectory: app.getPath("documents"),
    getMainWindow: () => mainWindow,
  });
  policy.initialize().then(() => service.initialize()).then(() => outputs.initialize()).then(async () => {
    const cleanup = setInterval(() => { artifacts.cleanup().catch((error: unknown) => console.error("Artifact cleanup failed", error)); }, 60 * 60_000);
    cleanup.unref();
    if (policy.settings().enabled) await agentServer.start().catch(() => policy.setEnabled(false));
    createWindow();
  }).catch((error) => {
    console.error("Formleaf storage initialization failed", error);
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((error: unknown) => { console.error("Formleaf startup failed", error); app.quit(); });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
