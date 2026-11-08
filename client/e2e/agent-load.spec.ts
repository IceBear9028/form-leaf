import * as Check from "../test/fixtures/assertions.ts";
import { test, expect, _electron as electron, type ElectronApplication } from "@playwright/test";
import electronPath from "../test/fixtures/electron-path.ts";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { DocumentRepository } from "../src/main/document/documentRepository.ts";
import { AccessPolicy, emptyGrants } from "../src/main/mcp/accessPolicy.ts";
import { agentDocument } from "../test/fixtures/agent-document.ts";

// eslint-disable-next-line no-empty-pattern -- Playwright requires a destructured fixture argument when using testInfo.
test("O07: 100000자 문서·연속/동시 출력의 지연·메모리·IME·worker 회수", async ({}, info) => {
  test.skip(process.env.FORMLEAF_LOAD_E2E !== "1", "FORMLEAF_LOAD_E2E=1로 부하 시험을 명시적으로 실행합니다.");
  test.setTimeout(300_000);
  const rounds = Number(process.env.FORMLEAF_LOAD_ROUNDS ?? 10);
  expect(Number.isInteger(rounds) && rounds >= 10 && rounds <= 60).toBe(true);
  const temporary = await mkdtemp(join(tmpdir(), "formleaf-agent-load-"));
  const userData = join(temporary, "user-data"); const workspace = join(userData, "workspaces");
  const repository = new DocumentRepository(workspace); const initial = await repository.create();
  const fixture = agentDocument(initial.document); fixture.name = "대용량 출력 fixture";
  Check.present(fixture.nodes.markdown, 'fixture object').visible = true;
  const paragraph = "한글 문서의 페이지와 순서를 확인합니다. 저장된 내용만 출력하고 편집 중인 내용은 유지합니다. ";
  Check.field(fixture.nodes.markdown, 'source').source = ("## 큰 문서\n\n" + Array.from({ length: 500 }, (_, i) => `문단 ${i + 1}. ${paragraph.repeat(5)}`).join("\n\n")).slice(0, 100_000);
  await repository.save(fixture.documentId, fixture);
  const policy = new AccessPolicy(workspace); await policy.initialize();
  const { connection, token } = await policy.create("load fixture");
  await policy.setGrants(connection.id, { ...emptyGrants(), documentIds: [fixture.documentId], render: true }); await policy.setEnabled(true);
  const client = new Client({ name: "load-fixture", version: "1" }); let app: ElectronApplication | undefined;
  let timer: ReturnType<typeof setInterval> | undefined; let sampling: Promise<void> | undefined;
  const samples: { elapsedMs: number; workingSetKiB: number; windows: number; editorResponseMs: number }[] = [];
  const timings: { kind: string; elapsedMs: number; pages?: number; bytes?: number }[] = [];
  const began = performance.now();
  try {
    app = await electron.launch({ executablePath: electronPath, args: ["."], cwd: process.cwd(), env: { ...process.env, DOCUMENT_USER_DATA_DIRECTORY: userData, DOCUMENT_E2E_HEADLESS: "1" } });
    const page = await app.firstWindow(); await page.getByRole("button", { name: /대용량 출력 fixture/ }).click();
    await client.connect(new StreamableHTTPClientTransport(new URL("http://127.0.0.1:32516/mcp"), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
    const saved = Check.toolResult("get_document", (Check.wireResult(await client.callTool({ name: "get_document", arguments: { documentId: fixture.documentId } }))).structuredContent);
    const revision = Check.success(saved).data.revision;
    const component = page.locator('.document-page-stack--screen [data-document-node-id="instance"] [data-document-edit-target="true"]').first();
    await component.locator("p").click();
    const editor = page.locator('[data-markdown-editor-host] .ProseMirror'); await expect(editor).toBeFocused();
    await editor.evaluate((element) => { window.loadEditor = element; });
    const cdp = await page.context().newCDPSession(page); await cdp.send("Input.imeSetComposition", { text: "조합보존", selectionStart: 4, selectionEnd: 4 });
    const sample = async () => {
      const start = performance.now(); await page.evaluate(() => document.readyState);
      const editorResponseMs = performance.now() - start;
      const value = await app!.evaluate(({ app, BrowserWindow }) => ({ workingSetKiB: app.getAppMetrics().reduce((sum, process) => sum + process.memory.workingSetSize, 0), windows: BrowserWindow.getAllWindows().length }));
      samples.push({ elapsedMs: performance.now() - began, ...value, editorResponseMs });
    };
    await sample(); timer = setInterval(() => { if (!sampling) sampling = sample().finally(() => { sampling = undefined; }); }, 500);
    const input = { documentId: fixture.documentId, expectedRevision: revision };
    const waitPdf = async (requestId: string) => {
      let result: ReturnType<typeof Check.toolResult<'get_operation'>> | undefined;
      await expect.poll(async () => { result = Check.toolResult("get_operation", (Check.wireResult(await client.callTool({ name: "get_operation", arguments: { requestId } }))).structuredContent); return Check.success(result).data.status; }, { timeout: 70_000 }).not.toBe("pending");
      expect(Check.present(result, "operation").ok).toBe(true); const completed = Check.success(Check.present(result, "operation")).data; expect(completed.status, JSON.stringify(result)).toBe("completed");
      const artifact = Check.field(Check.present(completed.result, "completed artifact"), "uri"); expect(artifact.revision).toBe(revision); return artifact;
    };
    let pages = 0;
    for (let index = 0; index < rounds; index++) {
      const start = performance.now();
      if (index % 2 === 0) {
        const output = Check.wireResult(await client.callTool({ name: "preview_document", arguments: { ...input, page: index === 8 ? pages : 1 } }));
        const result = Check.toolResult("preview_document", output.structuredContent); expect(result.ok, JSON.stringify(result)).toBe(true);
        pages = Check.success(result).data.pageCount; expect(pages).toBeGreaterThan(20);
        const image = output.content.find((item) => item.type === "image");
        const bytes = Buffer.from(Check.present(image, 'fixture object').data, "base64"); expect(bytes.length).toBeLessThanOrEqual(4 * 1024 * 1024);
        timings.push({ kind: "preview", elapsedMs: performance.now() - start, pages, bytes: bytes.length });
        if (index === 0 || index === 8) await writeFile(info.outputPath(`load-page-${Check.success(result).data.page}.png`), bytes);
      } else {
        const requestId = randomUUID(); const accepted = Check.toolResult("export_pdf", (Check.wireResult(await client.callTool({ name: "export_pdf", arguments: { ...input, requestId } }))).structuredContent);
        expect(accepted.ok, JSON.stringify(accepted)).toBe(true);
        const result = await waitPdf(requestId);
        timings.push({ kind: "pdf", elapsedMs: performance.now() - start, bytes: result.byteSize });
        if (index === 1) {
          const resource = await client.readResource({ uri: result.uri });
          await writeFile(info.outputPath("load-output.pdf"), Buffer.from((Check.blobResource(resource.contents[0])).blob, "base64"));
        }
      }
      await expect(editor).toBeFocused(); expect(await editor.evaluate((element) => element === window.loadEditor)).toBe(true);
      await expect(editor).toContainText("조합보존");
      const heartbeat = performance.now(); await page.evaluate(() => document.readyState);
      timings.push({ kind: "editor-heartbeat", elapsedMs: performance.now() - heartbeat });
      await expect.poll(() => app!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
      if ((index + 1) % 10 === 0) console.log(`Completed ${index + 1}/${rounds} output requests`);
    }
    // A missing layout-ready message must time out, close the worker, and leave
    // the queue usable. Change only this disposable app's listener, then restore.
    await app.evaluate(({ ipcMain }) => {
      (globalThis).loadReadyListeners = ipcMain.listeners("agent-render:ready").map(listener => listener as Parameters<typeof ipcMain.on>[1]);
      ipcMain.removeAllListeners("agent-render:ready");
    });
    const timedOutAt = performance.now();
    try {
      const failed = Check.toolResult("preview_document", (Check.wireResult(await client.callTool({ name: "preview_document", arguments: input }))).structuredContent);
      expect(failed.ok).toBe(false); expect(Check.failed(failed).error.code).toBe("RENDER_FAILED");
      timings.push({ kind: "layout-timeout", elapsedMs: performance.now() - timedOutAt });
    } finally {
      await app.evaluate(({ ipcMain }) => {
        for (const listener of globalThis.loadReadyListeners ?? []) ipcMain.on("agent-render:ready", listener);
        delete (globalThis).loadReadyListeners;
      });
    }
    const recovered = Check.toolResult("preview_document", (Check.wireResult(await client.callTool({ name: "preview_document", arguments: input }))).structuredContent);
    expect(recovered.ok).toBe(true); await expect(editor).toBeFocused(); await expect(editor).toContainText("조합보존");
    const burst = await Promise.all(Array.from({ length: 6 }, async () => {
      const requestId = randomUUID(); const result = Check.toolResult("export_pdf", (Check.wireResult(await client.callTool({ name: "export_pdf", arguments: { ...input, requestId } }))).structuredContent);
      return { requestId, result };
    }));
    for (const entry of burst) {
      if (entry.result.ok) await waitPdf(entry.requestId);
      else expect(Check.failed(entry.result).error.code).toBe("RESULT_TOO_LARGE");
    }
    await expect.poll(() => app!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
    expect(Math.max(...samples.map((item) => item.windows))).toBeLessThanOrEqual(2);
    expect(Math.max(...samples.map((item) => item.workingSetKiB))).toBeLessThan(2 * 1024 * 1024);
    await sample();
    await writeFile(info.outputPath("load-metrics.json"), JSON.stringify({ rounds, sourceLength: Check.field(fixture.nodes.markdown, 'source').source.length, platform: process.platform, sampleIntervalMs: 500, note: "Electron process working-set sum, sampled; shared pages may be counted more than once. Not a native peak RSS measurement.", pages, timings, samples, burst: burst.map(({ result }) => result.ok ? "accepted" : Check.failed(result).error.code) }, null, 2));
    await cdp.send("Input.insertText", { text: "조합보존" }); await cdp.detach();
  } finally {
    if (timer) clearInterval(timer); await sampling;
    await writeFile(info.outputPath("load-observations.json"), JSON.stringify({ timings, samples }, null, 2));
    await client.close(); await app?.close(); await rm(temporary, { recursive: true, force: true });
  }
});
