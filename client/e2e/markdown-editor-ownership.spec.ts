import { expect, test, _electron as electron, type ElectronApplication, type Page } from "@playwright/test";
import electronPath from "electron";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("active editor가 composition 중 DOM과 selection을 단독 소유한다", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "formleaf-editor-ownership."));
  let application: ElectronApplication | undefined;
  try {
    application = await electron.launch({
      executablePath: electronPath,
      args: ["."],
      cwd: process.cwd(),
      env: {
        ...process.env,
        DOCUMENT_USER_DATA_DIRECTORY: join(temporaryRoot, "user-data"),
        DOCUMENT_E2E_HEADLESS: "1",
        DOCUMENT_EDITOR_OWNERSHIP_SPIKE: "1",
      },
    });
    const page = await application.firstWindow();
    const editor = page.locator('[data-editor-ownership-host="true"] .ProseMirror');
    await expect(editor).toBeVisible();
    await focusAtEnd(editor);
    await editor.evaluate((element) => {
      (window as Window & { editorOwnershipRoot?: Element }).editorOwnershipRoot = element;
    });

    const cdp = await page.context().newCDPSession(page);
    await insertComposedText(cdp, "가");
    await cdp.send("Input.imeSetComposition", {
      text: "나",
      selectionStart: 1,
      selectionEnd: 1,
    });

    await page.locator('[data-editor-ownership-rerender="true"]').evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    await expect(page.locator('[data-editor-ownership-spike="true"]')).toHaveAttribute(
      "data-parent-revision",
      "1",
    );
    await expect(editor).toBeFocused();
    await expect.poll(() => editor.evaluate((element) => (
      (window as Window & { editorOwnershipRoot?: Element }).editorOwnershipRoot === element
    ))).toBe(true);
    await expect(editor).toContainText("경쟁: 가나");

    await cdp.send("Input.insertText", { text: "나" });
    await page.keyboard.press("Space");
    await insertComposedText(cdp, "다");

    await expect(editor).toHaveText("경쟁: 가나 다");
    await expect(page.locator('[data-editor-ownership-snapshot="true"]')).toHaveText("경쟁: 가나 다");
    await expect.poll(() => caretSuffix(page)).toBe("");
  } finally {
    await application?.close().catch(() => undefined);
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

async function focusAtEnd(editor: ReturnType<Page["locator"]>): Promise<void> {
  await editor.evaluate((element) => {
    const selection = window.getSelection();
    const range = document.createRange();
    element.focus();
    range.selectNodeContents(element);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
}

async function insertComposedText(
  cdp: Awaited<ReturnType<Page["context"]>["newCDPSession"]>,
  text: string,
): Promise<void> {
  await cdp.send("Input.imeSetComposition", {
    text,
    selectionStart: text.length,
    selectionEnd: text.length,
  });
  await cdp.send("Input.insertText", { text });
}

async function caretSuffix(page: Page): Promise<string | undefined> {
  return page.locator('[data-editor-ownership-host="true"] .ProseMirror').evaluate((element) => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !selection.anchorNode || !element.contains(selection.anchorNode)) {
      return undefined;
    }
    const suffix = document.createRange();
    suffix.setStart(selection.anchorNode, selection.anchorOffset);
    suffix.setEndAfter(element.lastChild!);
    return suffix.toString();
  });
}
