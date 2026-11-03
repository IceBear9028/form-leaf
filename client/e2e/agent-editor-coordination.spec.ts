import { test, expect, _electron as electron, type ElectronApplication } from "@playwright/test";
import electronPath from "electron";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createEmptyDocument, addNode } from "../src/foundation/document.ts";
import type { EditorReply, EditorRequest } from "../src/foundation/documentSessionProtocol.ts";

async function request(app: ElectronApplication, request: EditorRequest): Promise<EditorReply> {
  return app.evaluate(({ BrowserWindow, ipcMain }, request) => new Promise<EditorReply>((resolve, reject) => {
    const timeout = setTimeout(() => { ipcMain.removeListener("agent:editor-reply", listener); reject(new Error("IPC reply timeout")); }, 5000);
    const listener = (_event: unknown, reply: EditorReply) => {
      if (reply.requestId !== request.requestId) return;
      clearTimeout(timeout); ipcMain.removeListener("agent:editor-reply", listener); resolve(reply);
    };
    ipcMain.on("agent:editor-reply", listener);
    BrowserWindow.getAllWindows()[0].webContents.send("agent:editor-request", request);
  }), request);
}

test("F03/F08: 실제 renderer idle lease·snapshot ack·stale UI 저장·IME 거절", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "formleaf-agent-editor-"));
  const userData = join(temporary, "user-data");
  const workspace = join(userData, "workspaces");
  let document = createEmptyDocument({ documentId: "document-agent-editor", name: "Agent fixture" });
  document = addNode(document, document.rootNodeId, { id: "node-markdown", type: "markdown", name: "본문", visible: true, source: "입력 시작" });
  await mkdir(join(workspace, "documents"), { recursive: true });
  await writeFile(join(workspace, "documents", `${document.documentId}.document.json`), JSON.stringify(document));
  await writeFile(join(workspace, "documents.json"), JSON.stringify({ schemaVersion: 2, documents: [{ id: document.documentId, name: document.name, createdAt: document.updatedAt, updatedAt: document.updatedAt }], trash: [] }));
  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({ executablePath: electronPath as unknown as string, args: ["."], cwd: process.cwd(), env: { ...process.env, DOCUMENT_USER_DATA_DIRECTORY: userData, DOCUMENT_E2E_HEADLESS: "1" } });
    const page = await app.firstWindow();
    await page.getByRole("button", { name: /Agent fixture/ }).click();
    const preview = page.locator('.document-page-stack--screen [data-document-node-id="node-markdown"][data-document-edit-target="true"]');
    await expect(preview).toBeVisible();
    const initial = await page.evaluate((id) => window.documents.loadDocument(id), document.documentId);
    const leaseId = randomUUID();
    expect((await request(app, { type: "acquire", requestId: leaseId, documentId: document.documentId })).ok).toBe(true);
    expect(await page.locator("#root").evaluate((node) => node.inert)).toBe(true);
    const next = structuredClone(initial.document);
    if (next.nodes["node-markdown"].type === "markdown") next.nodes["node-markdown"].source = "외부 변경 적용";
    const saved = await page.evaluate(({ next, revision }) => window.documents.saveDocument(next.documentId, next, revision), { next, revision: initial.revision });
    const snapshot = await page.evaluate((id) => window.documents.loadDocument(id), document.documentId);
    expect(snapshot.revision).toBe(saved.revision);
    expect((await request(app, { type: "apply", requestId: randomUUID(), documentId: document.documentId, leaseId, snapshot })).ok).toBe(true);
    await request(app, { type: "release", requestId: randomUUID(), documentId: document.documentId, leaseId });
    expect(await page.locator("#root").evaluate((node) => node.inert)).toBe(false);
    await expect(preview).toContainText("외부 변경 적용");
    const stale = await page.evaluate(async ({ document, revision }) => {
      try { await window.documents.saveDocument(document.documentId, document, revision); return "unexpected save"; }
      catch (error) { return String(error); }
    }, initial);
    expect(stale).toContain("다시 읽고");
    await preview.locator("p").click();
    const editor = page.locator("[data-markdown-editor-host] .ProseMirror");
    await expect(editor).toBeFocused();
    await editor.evaluate((node) => { (window as any).agentEditorRoot = node; });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.imeSetComposition", { text: "한", selectionStart: 1, selectionEnd: 1 });
    const rejected = await request(app, { type: "acquire", requestId: randomUUID(), documentId: document.documentId });
    expect(rejected.ok).toBe(false);
    expect(rejected.context?.isEditing).toBe(true);
    expect(await editor.evaluate((node) => node === (window as any).agentEditorRoot)).toBe(true);
    await expect(editor).toBeFocused();
    expect(await page.locator("#root").evaluate((node) => node.inert)).toBe(false);
    await cdp.send("Input.insertText", { text: "한" });
    await cdp.detach();
  } finally {
    await app?.close();
    await rm(temporary, { recursive: true, force: true });
  }
});
