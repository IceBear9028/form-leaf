import { BrowserWindow, ipcMain, nativeImage } from "electron";
import { randomUUID } from "node:crypto";
import { isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { IPC } from "../../foundation/ipc.ts";
import { AGENT_LIMITS } from "../../foundation/documentCommandSchemas.ts";
import { CommandFailure, failure } from "../../foundation/documentCommands.ts";
import type { SavedDocument } from "../../foundation/documentSessionProtocol.ts";
import type { RenderReady } from "../../foundation/agentRenderProtocol.ts";
const readySchema = z.strictObject({ pageCount: z.number().int().positive(), pages: z.array(z.strictObject({ x: z.number().finite().nonnegative(), y: z.number().finite().nonnegative(), width: z.number().finite().positive(), height: z.number().finite().positive() })).min(1), warnings: z.array(z.string()) });
export type RenderOutput = { bytes: Buffer; pageCount: number; widthPx: number; heightPx: number; warnings: string[] };
export interface SnapshotRenderer { render(snapshot: SavedDocument, kind: "preview" | "pdf", page: number, authorize: () => void | Promise<void>): Promise<RenderOutput>; }
export class RenderService implements SnapshotRenderer {
  private queue: Promise<unknown> = Promise.resolve();
  private jobs = new Map<string, { window: BrowserWindow; snapshot: SavedDocument; resolve: (result: RenderReady) => void }>();
  private readonly rendererDirectory: string;
  private readonly preloadPath: string;
  constructor(rendererDirectory: string, preloadPath: string) {
    this.rendererDirectory = rendererDirectory; this.preloadPath = preloadPath;
    ipcMain.handle(IPC.renderSnapshot, (event, id: string) => {
      const job = this.jobs.get(id); if (!job || job.window.webContents !== event.sender) throw new Error("Unknown render job");
      return job.snapshot;
    });
    ipcMain.on(IPC.renderReady, (event, id: string, result: unknown) => {
      const job = this.jobs.get(id); if (!job || job.window.webContents !== event.sender) return;
      const parsed = readySchema.safeParse(result);
      if (parsed.success && parsed.data.pageCount === parsed.data.pages.length) job.resolve(parsed.data);
    });
  }
  render(snapshot: SavedDocument, kind: "preview" | "pdf", page: number, authorize: () => void | Promise<void>): Promise<RenderOutput> {
    let window: BrowserWindow | undefined; let canceled = false;
    const timeoutMs = kind === "preview" ? 30_000 : 60_000;
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { canceled = true; window?.destroy(); reject(new CommandFailure("RENDER_FAILED", "출력 준비 시간이 초과됐습니다.")); }, timeoutMs);
    });
    const task = this.queue.then(async () => {
      if (canceled) failure("RENDER_FAILED", "출력 대기 시간이 초과됐습니다.");
      await Promise.race([authorize(), timeout]);
      if (canceled) failure("RENDER_FAILED", "출력 대기 시간이 초과됐습니다.");
      const id = randomUUID(); const warnings = new Set<string>();
      window = new BrowserWindow({ show: false, focusable: false, width: 820, height: 1160, webPreferences: {
        preload: this.preloadPath, nodeIntegration: false, contextIsolation: true, sandbox: true,
        backgroundThrottling: false, partition: `formleaf-output-${id}`,
      } });
      const output = window;
      const devOrigin = process.env.ELECTRON_RENDERER_URL ? new URL(process.env.ELECTRON_RENDERER_URL).origin : undefined;
      output.webContents.session.webRequest.onBeforeRequest((details, callback) => {
        let allowed = false;
        try {
          const url = new URL(details.url);
          if (url.protocol === "data:" || url.protocol === "blob:") allowed = true;
          else if (url.protocol === "file:") { const path = relative(this.rendererDirectory, fileURLToPath(url)); allowed = !path.startsWith("..") && !isAbsolute(path); }
          else if (devOrigin && url.origin === devOrigin) allowed = true;
        } catch { /* Reject invalid resource URLs. */ }
        if (!allowed) warnings.add("문서의 외부 resource를 불러오지 않았습니다.");
        callback({ cancel: !allowed });
      });
      output.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      output.webContents.on("will-navigate", (event) => event.preventDefault());
      const ready = new Promise<RenderReady>((resolve) => this.jobs.set(id, { window: output, snapshot, resolve }));
      try {
        if (process.env.ELECTRON_RENDERER_URL) { const url = new URL(process.env.ELECTRON_RENDERER_URL); url.searchParams.set("agentRender", id); await Promise.race([output.loadURL(url.toString()), timeout]); }
        else await Promise.race([output.loadFile(join(this.rendererDirectory, "index.html"), { query: { agentRender: id } }), timeout]);
        const layout = await Promise.race([ready, timeout]);
        await Promise.race([authorize(), timeout]);
        layout.warnings.forEach((warning) => warnings.add(warning));
        if (kind === "pdf") {
          const bytes = await Promise.race([output.webContents.printToPDF({ pageSize: "A4", printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false, scale: 1 }), timeout]);
          if (bytes.length > AGENT_LIMITS.pdfBytes) failure("RESULT_TOO_LARGE", "PDF가 출력 크기 한도를 초과합니다.");
          return { bytes, pageCount: layout.pageCount, widthPx: 0, heightPx: 0, warnings: [...warnings] };
        }
        if (page > layout.pages.length) failure("PAGE_OUT_OF_RANGE", "요청한 페이지가 없습니다.", { pageCount: layout.pageCount });
        const bounds = layout.pages[page - 1];
        output.webContents.debugger.attach("1.3");
        const captured = await Promise.race([output.webContents.debugger.sendCommand("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { ...bounds, scale: Math.min(1, AGENT_LIMITS.previewEdgePx / Math.max(bounds.width, bounds.height)) } }), timeout]);
        let bitmap = nativeImage.createFromBuffer(Buffer.from(captured.data, "base64"));
        let size = bitmap.getSize();
        if (Math.max(size.width, size.height) > AGENT_LIMITS.previewEdgePx) bitmap = bitmap.resize({ width: Math.round(size.width * AGENT_LIMITS.previewEdgePx / Math.max(size.width, size.height)) });
        let bytes = bitmap.toPNG();
        while (bytes.length > AGENT_LIMITS.previewBytes && bitmap.getSize().width > 256) { bitmap = bitmap.resize({ width: Math.floor(bitmap.getSize().width * 0.75) }); bytes = bitmap.toPNG(); }
        if (bytes.length > AGENT_LIMITS.previewBytes) failure("RESULT_TOO_LARGE", "미리보기가 이미지 크기 한도를 초과합니다.");
        size = bitmap.getSize(); return { bytes, pageCount: layout.pageCount, widthPx: size.width, heightPx: size.height, warnings: [...warnings] };
      } catch (error) {
        if (error instanceof CommandFailure) throw error;
        failure("RENDER_FAILED", "문서 출력에 실패했습니다.");
      } finally { this.jobs.delete(id); if (!output.isDestroyed()) output.destroy(); }
    });
    this.queue = task.catch(() => undefined);
    return Promise.race([task, timeout]).finally(() => clearTimeout(timer));
  }
}
