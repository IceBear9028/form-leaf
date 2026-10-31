import { expect, test, _electron as electron, type ElectronApplication, type Locator, type Page } from "@playwright/test";
import electronPath from "electron";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  addComponentDefinition,
  addComponentInstance,
  addNode,
  createEmptyDocument,
  type DocumentData,
} from "../src/foundation/document.ts";

const documentId = "document-markdown-user-flow";

test("Preview editor ownership·전체 target lifecycle·저장·재열기·PDF", async () => {
  test.setTimeout(180_000);
  const temporaryRoot = await mkdtemp(join(tmpdir(), "formleaf-playwright-markdown."));
  const userData = join(temporaryRoot, "user-data");
  const pdfPath = join(temporaryRoot, "markdown-user-flow.pdf");
  await seedFixture(userData);
  const initial = await readFixture(userData);
  let application: ElectronApplication | undefined;
  try {
    ({ application } = await launchApplication(userData));
    let page = await application.firstWindow();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openFixture(page);
    const target = (id: string) => page.locator(`.document-page-stack--screen [data-document-node-id="${id}"][data-document-edit-target="true"]`);
    const editor = () => page.locator('[data-markdown-editor-host] .ProseMirror');
    const outside = () => target("node-outside");
    const component = () => page.locator('.document-page-stack--screen [data-document-node-id="node-instance"] [data-document-edit-target="true"]');
    const item = (id: string) => page.locator(`.document-page-stack--screen [data-repeater-item-id="${id}"] [data-document-edit-target="true"]`);

    await test.step("문단·제목·인용·불릿의 문서 선택과 클릭한 글자 위치", async () => {
      for (const [index, tag] of ["p", "h2", "blockquote p", "li"].entries()) {
        const block = target("node-selection").locator(`[data-markdown-preview-block="${index}"]`);
        await clickBeforeText(page, block.locator(tag).first(), "CD");
        await expect(editor()).toHaveCount(1);
        await expect(editor()).toBeFocused();
        await page.keyboard.insertText("X");
        await expect(editor()).toContainText("ABXCD");
        await expect.poll(() => target("node-selection").evaluateAll((elements) => elements.every((element) => element.getAttribute("data-document-selected") === "true"))).toBe(true);
        expect(await target("node-selection").evaluateAll((elements) => elements.every((element) => getComputedStyle(element).outlineStyle === "none"))).toBe(true);
      }
      await outside().click();
      await expect(editor()).toHaveCount(0);
      await expect(target("node-selection").first()).not.toHaveAttribute("data-document-selected", "true");
      await expect(outside()).toHaveAttribute("data-document-selected", "true");
      await expect.poll(async () => (await readFixture(userData)).nodes["node-selection"].source).toBe("문단 ABXCD\n\n## 제목 ABXCD\n\n> 인용 ABXCD\n\n- 목록 ABXCD");
    });

    await test.step("목록 Enter·Tab·Shift+Tab·빠른 삽입·제목 level", async () => {
      await activateAtEnd(page, target("node-direct").first());
      await page.keyboard.type("- ");
      await page.keyboard.insertText("첫 항목");
      await page.keyboard.press("Enter");
      await page.keyboard.insertText("둘째 항목");
      await page.keyboard.press("Tab");
      await expect(editor().locator("ul ul li")).toHaveText("둘째 항목");
      await page.keyboard.press("Shift+Tab");
      await expect(editor().locator("ul > li")).toHaveCount(2);
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await page.keyboard.type("/h2");
      await expect(page.getByRole("listbox", { name: "Markdown 빠른 삽입" })).toBeVisible();
      await page.keyboard.press("Enter");
      await page.keyboard.insertText("사용자 흐름");
      await outside().click();
      await expect.poll(async () => (await readFixture(userData)).nodes["node-direct"].source).toBe("- 첫 항목\n- 둘째 항목\n\n## 사용자 흐름");
      await activateAtEnd(page, target("node-heading-change"));
      await clickBeforeText(page, editor().locator("h1, h2, h3"), "기존");
      await page.keyboard.type("## ");
      await expect(editor().locator("h2")).toHaveText("기존 제목");
      await clickBeforeText(page, editor().locator("h1, h2, h3"), "기존");
      await page.keyboard.type("### ");
      await expect(editor().locator("h3")).toHaveText("기존 제목");
    });

    await test.step("빠른 한글·Space·composition 중 publish와 부모 rerender", async () => {
      await activateAtEnd(page, target("node-composition-caret"));
      await editor().evaluate((element) => { (window as any).ownershipRoot = element; });
      await page.keyboard.insertText("가");
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Input.imeSetComposition", { text: "나", selectionStart: 1, selectionEnd: 1 });
      await page.getByRole("button", { name: "확대", exact: true }).evaluate((element: HTMLButtonElement) => element.click());
      await page.getByRole("complementary", { name: "Properties" }).locator("input").first().evaluate((element) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
        setter.call(element, "IME 중 DocumentData publish");
        element.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.waitForTimeout(800);
      await expect(editor()).toBeFocused();
      expect(await editor().evaluate((element) => (window as any).ownershipRoot === element)).toBe(true);
      await expect(editor()).toHaveText("경쟁: 가나");
      expect((await readFixture(userData)).nodes["node-composition-caret"].source).toBe("경쟁: 가");
      expect((await readFixture(userData)).nodes["node-composition-caret"].name).toBe("IME 중 DocumentData publish");
      await cdp.send("Input.insertText", { text: "나" });
      for (const word of ["다", "빠른", "한글", "입력"]) {
        await page.keyboard.press("Space");
        await insertComposedText(cdp, word);
      }
      await page.keyboard.press("Space");
      await page.keyboard.press("Space");
      await page.keyboard.insertText("끝");
      await expect(editor()).toHaveText("경쟁: 가나 다 빠른 한글 입력  끝");
      expect(await editor().evaluate((element) => (window as any).ownershipRoot === element)).toBe(true);
      expect(await caretSuffix(editor())).toBe("");
      await expect(page.locator('.document-measure-page [contenteditable="true"]')).toHaveCount(0);
      await outside().click();
      await expect.poll(async () => (await readFixture(userData)).nodes["node-composition-caret"].source).toBe("경쟁: 가나 다 빠른 한글 입력  끝");
      await cdp.detach();
    });

    await test.step("toolbar·shortcut·undo/redo·literal paste", async () => {
      await activateAtEnd(page, target("node-shortcut"));
      await page.keyboard.press("Meta+b");
      await page.keyboard.insertText("굵게");
      await expect(editor().locator("strong")).toHaveText("굵게");
      await page.keyboard.press("Meta+z");
      await expect(editor()).toHaveText("");
      await page.keyboard.press("Meta+Shift+z");
      await expect(editor().locator("strong")).toHaveText("굵게");
      await page.keyboard.press("Meta+a");
      await page.getByRole("button", { name: "기울임", exact: true }).click();
      await expect(editor().locator("em")).toHaveText("굵게");
      await activateAtEnd(page, target("node-paste"));
      await editor().evaluate((element) => {
        const clipboardData = new DataTransfer();
        clipboardData.setData("text/plain", "**붙여넣기 원문**");
        element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData }));
      });
      await expect(editor()).toHaveText("**붙여넣기 원문**");
      await expect(editor().locator("strong")).toHaveCount(0);
    });

    await test.step("component·repeater prop lifecycle", async () => {
      await activateAtEnd(page, component().first());
      await page.keyboard.press("Enter");
      await page.keyboard.type("- ");
      await expect(component().first()).toHaveAttribute("data-document-selected", "true");
      await expect(page.locator('[data-document-selection-outline="true"][data-document-selection-target="instance:node-instance:prop:prop-markdown"]')).toHaveCount(1);
      await page.keyboard.insertText("컴포넌트 항목");
      await exercisePropComposition(page);
      await activateAtEnd(page, item("item-a").first());
      await page.keyboard.press("Enter");
      await page.keyboard.type("[] ");
      await expect(item("item-a").first()).toHaveAttribute("data-document-selected", "true");
      await expect(item("item-b").first()).not.toHaveAttribute("data-document-selected", "true");
      await page.keyboard.insertText("확인 항목");
      await exercisePropComposition(page);
      await editor().locator('input[type="checkbox"]').click();
      await activateAtEnd(page, item("item-b").first());
      await outside().click();
      await expect.poll(async () => {
        const doc = await readFixture(userData);
        return [doc.nodes["node-instance"].props["prop-markdown"], doc.nodes["node-repeater"].items[0].props["prop-markdown"], doc.nodes["node-repeater"].items[1].props["prop-markdown"], doc.components["component-markdown-card"].propDefinitions[0].defaultValue];
      }).toEqual(["컴포넌트 시작\n\n- 컴포넌트 항목 한글", "반복 A 시작\n\n- [x] 확인 항목 한글", "반복 B 유지", "컴포넌트 시작"]);
    });

    await test.step("09 작성 명령을 source 보정 없이 editor input rule로 실행한다", async () => {
      const cases = [
        ["* ", "ul"], ["2) ", "ol"], ["> ", "blockquote"], ["```", "pre"], ["---", "hr"],
        ["**굵게**", "strong"], ["*기울임*", "em"], ["~~취소선~~", "s"], ["`코드`", "code"],
        ["++밑줄++", "u"], ["[링크](https://example.com)", "a"],
      ];
      for (const [index, [input, selector]] of cases.entries()) {
        await activateAtEnd(page, target(`node-rule-${index}`));
        await page.keyboard.type(input);
        await expect(editor().locator(selector)).toHaveCount(1);
      }
      await activateAtEnd(page, target("node-empty-nested-indent").first());
      await page.keyboard.press("Tab");
      await expect(editor().locator("ul ul ul > li")).toHaveCount(1);
      await expect(target("node-empty-nested-indent").locator("h1")).toHaveText("다음 제목");
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Backspace");
      await expect(editor()).toBeFocused();
      await outside().click();
    });

    await test.step("table·image·footnote·reference·HTML read-only 보존", async () => {
      const fallback = target("node-fallback");
      for (const readonly of await fallback.locator('[data-markdown-readonly="true"]').all()) {
        if (!await readonly.isVisible()) continue;
        await readonly.click({ force: true });
        await expect(editor()).toHaveCount(0);
      }
      await activateAtEnd(page, fallback.first());
      await page.keyboard.insertText(" 수정");
      await outside().click();
      await expect.poll(async () => (await readFixture(userData)).nodes["node-fallback"].source).toBe(initial.nodes["node-fallback"].source.replace("수정 가능", "수정 가능 수정"));
    });

    await test.step("다른 page block 전환과 source range 갱신", async () => {
      const fragments = target("node-long");
      await expect(fragments).toHaveCount(36);
      await activateAtEnd(page, fragments.first());
      await page.keyboard.press("Enter");
      await page.keyboard.insertText("추가 문단");
      await activateAtEnd(page, fragments.nth(5));
      await page.keyboard.insertText(" 한글 입력");
      await expect(editor()).toHaveCount(1);
      await expect.poll(() => fragments.evaluateAll((elements) => elements.every((el) => el.getAttribute("data-document-selected") === "true"))).toBe(true);
      await outside().click();
      await expect.poll(async () => (await readFixture(userData)).nodes["node-long"].source).toContain("페이지 경계 확인 문장 3. 한글 입력");
    });

    await page.keyboard.press("Meta+s");
    await page.getByRole("button", { name: "문서 목록" }).click();
    await expect(page.getByText("로컬 문서 보관함")).toBeVisible();
    await application.close();
    ({ application } = await launchApplication(userData));
    page = await application.firstWindow();
    await openFixture(page);
    await expect(target("node-direct").locator("h2")).toHaveText("사용자 흐름");
    await expect(target("node-shortcut").locator("strong")).toHaveText("굵게");
    await expect(item("item-a").locator('input[type="checkbox"]')).toBeChecked();
    await expect(editor()).toHaveCount(0);
    await application.evaluate(async ({ dialog }, destination) => {
      dialog.showSaveDialog = async () => {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        return { canceled: false, filePath: destination };
      };
    }, pdfPath);
    await page.getByRole("button", { name: "PDF 내보내기" }).click();
    const print = page.locator(".document-print-surface");
    await expect(print).toBeAttached();
    for (const text of ["사용자 흐름", "컴포넌트 항목", "확인 항목", "한글 입력"]) await expect(print).toContainText(text);
    await expect(print.locator('[contenteditable="true"], [data-document-selected="true"], [data-markdown-editor-host]')).toHaveCount(0);
    await expect(print.locator('input[type="checkbox"]').first()).toBeChecked();
    await expect(page.getByText("PDF 저장 완료")).toBeVisible({ timeout: 20_000 });
    expect((await stat(pdfPath)).size).toBeGreaterThan(1_000);
    expect((await readFile(pdfPath)).subarray(0, 5).toString("ascii")).toBe("%PDF-");
    await test.step("앱 종료는 진행 중인 editor를 flush하고 저장을 기다린다", async () => {
      await activateAtEnd(page, target("node-empty-composition"));
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Input.imeSetComposition", { text: "종료 저장", selectionStart: 5, selectionEnd: 5 });
      await application!.close();
      application = undefined;
      expect((await readFixture(userData)).nodes["node-empty-composition"].source).toBe("종료 저장");
      ({ application } = await launchApplication(userData));
      page = await application.firstWindow();
      await openFixture(page);
      await expect(target("node-empty-composition")).toHaveText("종료 저장");
    });
    expect(errors).toEqual([]);
  } finally {
    await application?.close().catch(() => undefined);
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

async function exercisePropComposition(page: Page) {
  const root = page.locator('[data-markdown-editor-host] .ProseMirror');
  await root.evaluate((element) => { (window as any).propEditorRoot = element; });
  await page.keyboard.press("Space");
  const cdp = await page.context().newCDPSession(page);
  await insertComposedText(cdp, "한");
  await cdp.send("Input.imeSetComposition", { text: "글", selectionStart: 1, selectionEnd: 1 });
  await page.getByRole("button", { name: "축소", exact: true }).evaluate((element: HTMLButtonElement) => element.click());
  await expect(root).toBeFocused();
  expect(await root.evaluate((element) => (window as any).propEditorRoot === element)).toBe(true);
  await cdp.send("Input.insertText", { text: "글" });
  expect(await caretSuffix(root)).toBe("");
  await cdp.detach();
}

async function activateAtEnd(page: Page, target: Locator): Promise<void> {
  await target.locator('[data-markdown-preview-block]').first().click();
  const editor = page.locator('[data-markdown-editor-host] .ProseMirror');
  await expect(editor).toBeFocused();
  await editor.evaluate((element: HTMLElement) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
}
async function clickBeforeText(page: Page, locator: Locator, suffix: string) {
  await locator.scrollIntoViewIfNeeded();
  const point = await locator.evaluate((element, suffix) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const index = node.textContent?.indexOf(suffix) ?? -1;
      if (index < 0) continue;
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + 1);
      const rect = range.getBoundingClientRect();
      return { x: rect.left + 1, y: rect.top + rect.height / 2 };
    }
    throw new Error("클릭할 글자 위치가 없습니다.");
  }, suffix);
  await page.mouse.click(point.x, point.y);
}
async function caretSuffix(editor: Locator) {
  return editor.evaluate((element) => {
    const selection = window.getSelection();
    if (!selection?.anchorNode) return undefined;
    const range = document.createRange();
    range.selectNodeContents(element);
    range.setStart(selection.anchorNode, selection.anchorOffset);
    return range.toString();
  });
}
async function insertComposedText(cdp: Awaited<ReturnType<Page["context"]>["newCDPSession"]>, text: string) {
  await cdp.send("Input.imeSetComposition", { text, selectionStart: text.length, selectionEnd: text.length });
  await cdp.send("Input.insertText", { text });
}
async function launchApplication(userData: string): Promise<{ application: ElectronApplication }> {
  const application = await electron.launch({
    executablePath: electronPath,
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      DOCUMENT_USER_DATA_DIRECTORY: userData,
      DOCUMENT_E2E_HEADLESS: "1",
    },
  });
  return { application };
}

async function openFixture(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: /Markdown 사용자 흐름 테스트/ })).toBeVisible();
  await page.getByRole("button", { name: /Markdown 사용자 흐름 테스트/ }).click();
  await expect(page.getByRole("main", { name: "문서 미리보기" })).toBeVisible();
}

async function seedFixture(userData: string): Promise<void> {
  const now = "2026-10-18T00:00:00.000Z";
  let sequence = 0;
  let document = createEmptyDocument({
    documentId,
    name: "Markdown 사용자 흐름 테스트",
    now,
    createId: (prefix) => `${prefix}-fixture-${++sequence}`,
  });
  const rootNodeId = document.rootNodeId;
  const options = { now: () => now };
  document = addNode(document, rootNodeId, {
    id: "node-direct", type: "markdown", name: "직접 Markdown", visible: true, source: "",
  }, undefined, options);
  document = addNode(document, rootNodeId, {
    id: "node-spaces", type: "markdown", name: "연속 공백 Markdown", visible: true, source: "",
  }, undefined, options);
  document = addNode(document, rootNodeId, {
    id: "node-indent-scope", type: "markdown", name: "들여쓰기 범위 Markdown", visible: true,
    source: "- 첫째\n- 둘째\n- h\n# 아래 제목",
  }, undefined, options);
  document = addNode(document, rootNodeId, {
    id: "node-empty-nested-indent", type: "markdown", name: "빈 중첩 불릿 Markdown", visible: true,
    source: "- 상위\n    - 기존 하위\n    - \n# 다음 제목",
  }, undefined, options);
  document = addNode(document, rootNodeId, {
    id: "node-strong-break", type: "markdown", name: "굵은 목록 줄바꿈 Markdown", visible: true,
    source: "- 첫째\n- 구축한 모델을 **작업자별 생산성 모니터링 기능으로 확장**\n\n## 다음 제목",
  }, undefined, options);
  document = addNode(document, rootNodeId, {
    id: "node-heading-change", type: "markdown", name: "제목 변경 Markdown", visible: true,
    source: "# 기존 제목",
  }, undefined, options);
  document = addNode(document, rootNodeId, {
    id: "node-composition", type: "markdown", name: "한글 조합 Markdown", visible: true,
    source: "조합: ",
  }, undefined, options);
  document = addNode(document, rootNodeId, {
    id: "node-composition-space", type: "markdown", name: "공백 확정 한글 조합 Markdown", visible: true,
    source: "공백: ",
  }, undefined, options);
  document = addNode(document, rootNodeId, {
    id: "node-composition-caret", type: "markdown", name: "빠른 한글 caret Markdown", visible: true,
    source: "경쟁: ",
  }, undefined, options);
  document = addNode(document, rootNodeId, {
    id: "node-empty-composition", type: "markdown", name: "빈 한글 조합 Markdown", visible: true,
    source: "",
  }, undefined, options);
  document = addNode(document, rootNodeId, {
    id: "node-composition-burst", type: "markdown", name: "연속 한글 조합 Markdown", visible: true,
    source: "연속: ",
  }, undefined, options);
  document = addNode(document, rootNodeId, {
    id: "node-composition-replacement", type: "markdown", name: "한글 조합 교체 Markdown", visible: true,
    source: "치환: ㅎ",
  }, undefined, options);
  document = addNode(document, rootNodeId, {
    id: "node-shortcut", type: "markdown", name: "단축키 Markdown", visible: true, source: "",
  }, undefined, options);
  document = addNode(document, rootNodeId, {
    id: "node-paste", type: "markdown", name: "붙여넣기 Markdown", visible: true, source: "",
  }, undefined, options);
  document = addComponentDefinition(document, {
    id: "component-markdown-card",
    name: "Markdown 카드",
    rootNodeId: "component-root",
    propDefinitions: [{
      id: "prop-markdown",
      name: "본문",
      status: "active",
      valueType: "markdown",
      binding: { nodeId: "component-markdown", property: "markdown.source" },
      defaultValue: "컴포넌트 시작",
    }],
  }, {
    "component-root": { id: "component-root", type: "container", name: "컴포넌트 Root", visible: true, childIds: ["component-markdown"] },
    "component-markdown": { id: "component-markdown", type: "markdown", name: "컴포넌트 Markdown", visible: true, source: "컴포넌트 시작" },
  }, options);
  document = addComponentInstance(document, rootNodeId, {
    id: "node-instance",
    type: "component-instance",
    name: "컴포넌트 Markdown",
    visible: true,
    componentId: "component-markdown-card",
    props: { "prop-markdown": "컴포넌트 시작" },
  }, undefined, options);
  document = addNode(document, rootNodeId, {
    id: "node-repeater",
    type: "repeater",
    name: "반복 Markdown",
    visible: true,
    itemComponentId: "component-markdown-card",
    items: [
      { id: "item-a", componentId: "component-markdown-card", visible: true, props: { "prop-markdown": "반복 A 시작" } },
      { id: "item-b", componentId: "component-markdown-card", visible: true, props: { "prop-markdown": "반복 B 유지" } },
    ],
  }, undefined, options);
  document = addNode(document, rootNodeId, {
    id: "node-long",
    type: "markdown",
    name: "긴 Markdown",
    visible: true,
    source: Array.from({ length: 18 }, (_, index) => `### 긴 문단 ${index + 1}\n\n페이지 경계 확인 문장 ${index + 1}.`).join("\n\n"),
  }, undefined, options);

  document = addNode(document, rootNodeId, {
    id: "node-selection", type: "markdown", name: "선택 경계", visible: true,
    source: "문단 ABCD\n\n## 제목 ABCD\n\n> 인용 ABCD\n\n- 목록 ABCD",
  }, undefined, options);
  document = addNode(document, rootNodeId, {
    id: "node-fallback", type: "markdown", name: "원문 보존", visible: true,
    source: "수정 가능\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n![이미지](https://example.com/a.png)\n\n[참조][ref]\n\n[ref]: https://example.com\n\n각주[^1]\n\n[^1]: 설명\n\n<div>원문</div>",
  }, undefined, options);
  document = addNode(document, rootNodeId, {
    id: "node-outside", type: "text", name: "외부 텍스트", visible: true, value: "외부 요소",
  }, undefined, options);

  for (let index = 0; index < 11; index += 1) {
    document = addNode(document, rootNodeId, { id: `node-rule-${index}`, type: "markdown", name: `명령 ${index}`, visible: true, source: "" }, undefined, options);
  }
  const workspace = join(userData, "workspaces");
  await mkdir(join(workspace, "documents"), { recursive: true });
  await mkdir(join(workspace, "document-trash"), { recursive: true });
  await writeFile(join(workspace, "documents", `${documentId}.document.json`), `${JSON.stringify(document, null, 2)}\n`);
  await writeFile(join(workspace, "documents.json"), `${JSON.stringify({
    schemaVersion: 2,
    documents: [{ id: documentId, name: document.name, createdAt: now, updatedAt: now }],
    trash: [],
  }, null, 2)}\n`);
}

async function readFixture(userData: string): Promise<DocumentData> {
  return JSON.parse(await readFile(
    join(userData, "workspaces", "documents", `${documentId}.document.json`),
    "utf8",
  )) as DocumentData;
}
