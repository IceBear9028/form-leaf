import { expect, test, _electron as electron, type ElectronApplication } from "@playwright/test";
import electronPath from "electron";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DocumentData } from "../src/foundation/documentModel.ts";
import { documentEditTargetKey, readDocumentEditValue, updateDocumentEditValue, type DocumentEditTarget } from "../src/foundation/documentEditing.ts";
import { buildRenderTree, type RenderTreeNode } from "../src/renderer/src/pages/document-editor/rendering/renderTree.ts";
import { parseMarkdownBlocks } from "../src/renderer/src/pages/document-editor/markdown/parser.ts";
import { inspectMarkdownEditorCompatibility } from "../src/renderer/src/pages/document-editor/markdown/editor/markdownEditorCompatibility.ts";

test.use({ trace: "off", screenshot: "off" });

// Explicit opt-in: the original is only read/hashed. Electron receives a disposable
// workspace containing a copy; no original path is passed to the application.
test("기존 문서 복사본의 한글 작성·저장·재열기·PDF와 원본 불변", async () => {
  const originalPath = process.env.FORMLEAF_EXISTING_DOCUMENT_FIXTURE;
  test.skip(!originalPath, "FORMLEAF_EXISTING_DOCUMENT_FIXTURE로 read-only 원본을 지정합니다.");
  test.setTimeout(120_000);
  const original = await readFile(originalPath!);
  const checksum = createHash("sha256").update(original).digest("hex");
  const document = JSON.parse(original.toString("utf8")) as DocumentData;
  document.documentId = "document-existing-copy";
  document.name = "기존 문서 안전한 복사본";
  const temporaryRoot = await mkdtemp(join(tmpdir(), "formleaf-existing-copy."));
  const userData = join(temporaryRoot, "user-data");
  const workspace = join(userData, "workspaces");
  const copyPath = join(workspace, "documents", `${document.documentId}.document.json`);
  const pdfPath = join(temporaryRoot, "existing-copy.pdf");
  await mkdir(join(workspace, "documents"), { recursive: true });
  await writeFile(copyPath, JSON.stringify(document));
  await writeFile(join(workspace, "documents.json"), JSON.stringify({ schemaVersion: 2, documents: [{ id: document.documentId, name: document.name, createdAt: document.updatedAt, updatedAt: document.updatedAt }], trash: [] }));
  let application: ElectronApplication | undefined;
  const launch = () => electron.launch({ executablePath: electronPath, args: ["."], cwd: process.cwd(), env: { ...process.env, DOCUMENT_USER_DATA_DIRECTORY: userData, DOCUMENT_E2E_HEADLESS: "1" } });
  try {
    application = await launch();
    let page = await application.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await page.getByRole("button", { name: /기존 문서 안전한 복사본/ }).click();
    await expect(page.getByRole("main", { name: "문서 미리보기" })).toBeVisible();
    let editedTarget: DocumentEditTarget | undefined;
    for (const node of markdownNodes(buildRenderTree(document)).sort((left, right) => right.source.length - left.source.length)) {
      if (!node.editTarget) continue;
      const blocks = parseMarkdownBlocks(node.source);
      for (let index = 0; index < blocks.length; index += 1) {
        if (!["paragraph", "heading"].includes(blocks[index].node.type) || !inspectMarkdownEditorCompatibility(node.source, index).editable) continue;
        const block = page.locator(`.document-page-stack--screen [data-document-edit-target-key="${documentEditTargetKey(node.editTarget)}"] [data-markdown-preview-block="${index}"]`);
        if (!await block.count() || !await block.first().isVisible()) continue;
        if (!await block.first().click({ trial: true, timeout: 1_000 }).then(() => true, () => false)) continue;
        await block.first().click();
        editedTarget = node.editTarget;
        break;
      }
      if (editedTarget) break;
    }
    expect(Boolean(editedTarget)).toBe(true);
    const root = page.locator('[data-markdown-editor-host] .ProseMirror');
    await expect(root).toBeFocused();
    await root.evaluate((element) => {
      const range = window.document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      window.document.dispatchEvent(new Event("selectionchange"));
    });
    await page.keyboard.press("Space");
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.imeSetComposition", { text: "복사본검증", selectionStart: 5, selectionEnd: 5 });
    await cdp.send("Input.insertText", { text: "복사본검증" });
    await page.getByRole("button", { name: "문서 목록" }).click();
    await expect(page.getByText("로컬 문서 보관함")).toBeVisible();
    const saved = JSON.parse(await readFile(copyPath, "utf8")) as DocumentData;
    // Keep private text out of assertion output, including failures.
    const savedSource = readDocumentEditValue(saved, editedTarget!);
    expect(typeof savedSource === "string" && savedSource.includes("복사본검증")).toBe(true);
    const expectedDocument = updateDocumentEditValue(document, editedTarget!, savedSource);
    expect(JSON.stringify(saved.nodes) === JSON.stringify(expectedDocument.nodes)).toBe(true);
    await application.close();
    application = await launch();
    page = await application.firstWindow();
    await page.getByRole("button", { name: /기존 문서 안전한 복사본/ }).click();
    expect((await page.locator('.document-page-stack--screen').textContent())?.includes("복사본검증")).toBe(true);
    await application.evaluate(({ dialog }, destination) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: destination });
    }, pdfPath);
    await page.getByRole("button", { name: "PDF 내보내기" }).click();
    await expect(page.getByText("PDF 저장 완료")).toBeVisible({ timeout: 30_000 });
    expect((await stat(pdfPath)).size > 1_000).toBe(true);
    expect((await readFile(pdfPath)).subarray(0, 5).toString("ascii")).toBe("%PDF-");
  } finally {
    await application?.close().catch(() => undefined);
    await rm(temporaryRoot, { recursive: true, force: true });
    expect(createHash("sha256").update(await readFile(originalPath!)).digest("hex") === checksum).toBe(true);
  }
});

function markdownNodes(node: RenderTreeNode): Extract<RenderTreeNode, { type: "markdown" }>[] {
  if (node.type === "markdown") return [node];
  if (node.type === "container") return node.children.flatMap(markdownNodes);
  if (node.type === "component-instance") return markdownNodes(node.child);
  if (node.type === "repeater") return node.items.flatMap((item) => markdownNodes(item.child));
  return [];
}
