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

test("Preview Markdown 사용자 흐름은 입력을 가로채지 않고 작성·저장·재열기·PDF를 유지한다", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "formleaf-playwright-markdown."));
  const userData = join(temporaryRoot, "user-data");
  const pdfPath = join(temporaryRoot, "markdown-user-flow.pdf");
  await seedFixture(userData);

  let application: ElectronApplication | undefined;
  try {
    ({ application } = await launchApplication(userData));
    let page = await application.firstWindow();
    expect(await application.evaluate(({ app }) => app.getName())).toBe("Formleaf");
    await expect(page).toHaveTitle("Formleaf");
    await expect(page.getByText("Formleaf", { exact: true })).toBeVisible();
    await openFixture(page);

    const directSelector = '[data-document-node-id="node-direct"][data-document-edit-target="true"]';
    const spacesSelector = '[data-document-node-id="node-spaces"][data-document-edit-target="true"]';
    const indentScopeSelector = '[data-document-node-id="node-indent-scope"][data-document-edit-target="true"]';
    const emptyNestedIndentSelector = '[data-document-node-id="node-empty-nested-indent"][data-document-edit-target="true"]';
    const strongBreakSelector = '[data-document-node-id="node-strong-break"][data-document-edit-target="true"]';
    const headingChangeSelector = '[data-document-node-id="node-heading-change"][data-document-edit-target="true"]';
    const compositionSelector = '[data-document-node-id="node-composition"][data-document-edit-target="true"]';
    const compositionSpaceSelector = '[data-document-node-id="node-composition-space"][data-document-edit-target="true"]';
    const compositionCaretSelector = '[data-document-node-id="node-composition-caret"][data-document-edit-target="true"]';
    const emptyCompositionSelector = '[data-document-node-id="node-empty-composition"][data-document-edit-target="true"]';
    const compositionBurstSelector = '[data-document-node-id="node-composition-burst"][data-document-edit-target="true"]';
    const compositionReplacementSelector = '[data-document-node-id="node-composition-replacement"][data-document-edit-target="true"]';
    const shortcutSelector = '[data-document-node-id="node-shortcut"][data-document-edit-target="true"]';
    const pasteSelector = '[data-document-node-id="node-paste"][data-document-edit-target="true"]';
    const componentSelector = '[data-document-node-id="node-instance"] [data-document-node-id="component-markdown"][data-document-edit-target="true"]';
    const repeaterASelector = '[data-repeater-item-id="item-a"] [data-document-node-id="component-markdown"][data-document-edit-target="true"]';
    const repeaterBSelector = '[data-repeater-item-id="item-b"] [data-document-node-id="component-markdown"][data-document-edit-target="true"]';

    await test.step("한 번에 하나의 데이터 소유 단위만 편집 focus를 가진다", async () => {
      await activateAtEnd(page, page.locator(directSelector));
      await activateAtEnd(page, page.locator(componentSelector));
      await activateAtEnd(page, page.locator(repeaterASelector));
      await expect(page.locator('[data-document-edit-active="true"]')).toHaveCount(1);
      await expect(page.locator(repeaterASelector).last()).toHaveAttribute("data-document-edit-active", "true");
      await expect(page.locator('[data-document-selected="true"]')).toHaveCount(0);
    });

    await test.step("같은 Markdown의 pagination 조각 클릭은 선택 단위를 바꾸지 않고 caret만 옮긴다", async () => {
      const fragments = page.locator('[data-document-node-id="node-long"][data-document-edit-target="true"]');
      await expect(fragments).toHaveCount(36);
      const firstFragment = fragments.first();
      await activateAtEnd(page, firstFragment);
      const anchorRenderId = await firstFragment.getAttribute("data-document-render-id");
      const targetKey = await firstFragment.getAttribute("data-document-edit-target-key");
      expect(anchorRenderId).toBeTruthy();
      expect(targetKey).toBe("node:node-long");

      const laterFragment = fragments.nth(5);
      await laterFragment.scrollIntoViewIfNeeded();
      await laterFragment.locator('[data-markdown-source-map]').last().click();

      await expect(page.locator('[data-document-edit-active="true"]')).toHaveCount(1);
      await expect(firstFragment).toHaveAttribute("data-document-edit-active", "true");
      await expect(firstFragment).toHaveAttribute("data-document-render-id", anchorRenderId!);
      await expect(laterFragment).not.toHaveAttribute("data-document-edit-active", "true");
      await expect(laterFragment).toHaveAttribute("data-document-edit-target-key", targetKey!);
      await expect(page.locator('[data-document-selected="true"]')).toHaveCount(0);
    });

    await test.step("목록을 연속 작성하고 빠른 삽입으로 제목을 만든다", async () => {
      await activateAtEnd(page, page.locator(directSelector));
      await page.keyboard.press("Minus");
      await expect(page.locator(`${directSelector} [contenteditable="true"]`)).toBeFocused();
      await page.keyboard.press("Space");
      await expect.poll(async () => (await readFixture(userData)).nodes["node-direct"].source).toBe("- ");
      await page.keyboard.insertText("첫 항목");
      await page.keyboard.press("Enter");
      await page.keyboard.insertText("둘째 항목");
      await dispatchEditingKey(page, "Tab", "Tab");
      await expect.poll(async () => (await readFixture(userData)).nodes["node-direct"].source).toBe(
        "- 첫 항목\n    - 둘째 항목",
      );
      await dispatchEditingKey(page, "Tab", "Tab", true);
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await insertSequentially(page, "/h2");
      await expect(page.getByRole("listbox", { name: "Markdown 빠른 삽입" })).toBeVisible();
      await page.keyboard.press("Enter");
      await page.keyboard.insertText("사용자 흐름");
      await activateAtEnd(page, page.locator(componentSelector));
      await expect.poll(async () => (await readFixture(userData)).nodes["node-direct"].source).toBe(
        "- 첫 항목\n- 둘째 항목\n\n## 사용자 흐름",
      );
    });

    await test.step("Space keydown을 연속 입력하면 공백을 그대로 보존한다", async () => {
      await activateAtEnd(page, page.locator(spacesSelector));
      await page.keyboard.insertText("앞");
      await page.keyboard.press("Space");
      await page.keyboard.press("Space");
      await page.keyboard.press("Space");
      await page.keyboard.insertText("뒤");
      await activateAtEnd(page, page.locator(componentSelector));
      await expect.poll(async () => (await readFixture(userData)).nodes["node-spaces"].source).toBe("앞   뒤");
      await expect(page.locator(spacesSelector)).toContainText("앞   뒤");
    });

    await test.step("Tab은 현재 항목만 들여쓰고 아래 h 항목의 계층을 유지한다", async () => {
      const target = page.locator(indentScopeSelector);
      await activateAtEnd(page, target);
      const secondItemText = target.locator(".markdown-list > li").nth(1)
        .locator('[data-markdown-source-map]').last();
      const box = await secondItemText.boundingBox();
      if (!box) throw new Error("둘째 목록 항목의 source 위치를 찾지 못했습니다.");
      await secondItemText.click({ position: { x: Math.max(1, box.width - 1), y: Math.max(1, box.height / 2) } });
      await dispatchEditingKey(page, "Tab", "Tab");
      await activateAtEnd(page, page.locator(componentSelector));
      await expect.poll(async () => (await readFixture(userData)).nodes["node-indent-scope"].source).toBe(
        "- 첫째\n    - 둘째\n- h\n# 아래 제목",
      );
      await expect(target.locator(".markdown-list").first().locator(":scope > li")).toHaveCount(2);
      await expect(target.locator("h1")).toHaveText("아래 제목");
    });

    await test.step("빈 중첩 불릿을 Tab으로 들여써도 다음 제목으로 바뀌거나 focus가 이동하지 않는다", async () => {
      const target = page.locator(emptyNestedIndentSelector).filter({
        has: page.locator(".markdown-empty-list-item"),
      });
      const caret = target.locator(".markdown-empty-list-item [data-markdown-source-map]");
      await caret.evaluate((element) => {
        element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      await caret.evaluate((element) => {
        const editable = element.closest<HTMLElement>('[contenteditable="true"]');
        const text = element.firstChild;
        if (!editable || !text) throw new Error("빈 중첩 불릿 caret을 찾지 못했습니다.");
        editable.focus();
        const range = document.createRange();
        range.setStart(text, text.textContent?.length ?? 0);
        range.collapse(true);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      });
      await dispatchEditingKey(page, "Tab", "Tab");

      await expect.poll(async () => (await readFixture(userData)).nodes["node-empty-nested-indent"].source).toBe(
        "- 상위\n    - 기존 하위\n        - \n# 다음 제목",
      );
      const activeTarget = page.locator(`${emptyNestedIndentSelector}[data-document-edit-active="true"]`);
      await expect(activeTarget).toHaveCount(1);
      await expect(activeTarget.locator(".markdown-empty-list-item")).toHaveCount(1);
      await expect(activeTarget.locator("h1, h2, h3, h4, h5, h6")).toHaveCount(0);
      await expect(page.locator(`${emptyNestedIndentSelector} h1`)).toHaveText("다음 제목");
    });

    await test.step("굵은 목록 끝의 Shift+Enter는 닫는 marker 뒤에 줄바꿈을 둔다", async () => {
      const target = page.locator(strongBreakSelector);
      const strongText = target.locator("strong [data-markdown-source-map]").last();
      await strongText.scrollIntoViewIfNeeded();
      const box = await strongText.boundingBox();
      if (!box) throw new Error("굵은 목록 문장의 source 위치를 찾지 못했습니다.");
      await strongText.click({
        position: { x: Math.max(1, box.width - 1), y: Math.max(1, box.height / 2) },
      });
      await dispatchEditingKey(page, "Enter", "Enter", true);
      await activateAtEnd(page, page.locator(componentSelector));

      await expect.poll(async () => (await readFixture(userData)).nodes["node-strong-break"].source).toBe(
        "- 첫째\n- 구축한 모델을 **작업자별 생산성 모니터링 기능으로 확장**<br>\n\n## 다음 제목",
      );
      await expect(target.locator("strong").filter({ hasText: "작업자별 생산성 모니터링 기능으로 확장" })).toHaveCount(1);
      expect((await target.allTextContents()).join("")).not.toContain("**");
    });

    await test.step("이미 적용된 제목의 첫 글자 앞에서 marker를 다시 입력하면 level이 계속 변경된다", async () => {
      const target = page.locator(headingChangeSelector);
      await setMarkdownCaretAtFirstText(target);
      await page.keyboard.insertText("##");
      await page.keyboard.press("Space");
      await expect.poll(async () => (await readFixture(userData)).nodes["node-heading-change"].source).toBe(
        "## 기존 제목",
      );
      await expect(target.locator("h2")).toHaveText("기존 제목");

      await setMarkdownCaretAtFirstText(target);
      await page.keyboard.insertText("###");
      await page.keyboard.press("Space");
      await expect.poll(async () => (await readFixture(userData)).nodes["node-heading-change"].source).toBe(
        "### 기존 제목",
      );
      await expect(target.locator("h3")).toHaveText("기존 제목");
    });

    await test.step("굵은 구간 끝의 한글 조합 직후 Space는 닫는 marker 밖에 입력된다", async () => {
      const target = page.locator(strongBreakSelector);
      const strongText = target.locator("strong [data-markdown-source-map]").last();
      const box = await strongText.boundingBox();
      if (!box) throw new Error("굵은 목록 문장의 source 위치를 찾지 못했습니다.");
      await strongText.click({
        position: { x: Math.max(1, box.width - 1), y: Math.max(1, box.height / 2) },
      });
      const cdp = await page.context().newCDPSession(page);
      await insertComposedText(cdp, "는");
      await page.keyboard.press("Space");
      await insertComposedText(cdp, "아");
      await activateAtEnd(page, page.locator(componentSelector));

      await expect.poll(async () => (await readFixture(userData)).nodes["node-strong-break"].source).toBe(
        "- 첫째\n- 구축한 모델을 **작업자별 생산성 모니터링 기능으로 확장는** 아<br>\n\n## 다음 제목",
      );
      expect((await target.allTextContents()).join("")).not.toContain("**");
    });

    await test.step("한글 조합 확정 echo는 중복 저장하지 않고 다음 Space는 보존한다", async () => {
      await activateAtEnd(page, page.locator(compositionSelector));
      await dispatchCompositionCommit(page, compositionSelector, "한글", false);
      await page.keyboard.press("Space");
      await dispatchCompositionCommit(page, compositionSelector, "입력", true);
      await activateAtEnd(page, page.locator(componentSelector));

      await expect.poll(async () => (await readFixture(userData)).nodes["node-composition"].source).toBe(
        "조합: 한글 입력",
      );
    });

    await test.step("Space keydown이 조합 확정 echo보다 먼저 와도 직전 한글을 중복하지 않는다", async () => {
      const words = ["띄어쓰기가", "자주", "일어나도", "중복되지", "않는다"];
      for (const word of words) {
        await activateAtEnd(page, page.locator(compositionSpaceSelector));
        await dispatchSpaceTriggeredCompositionCommit(page, compositionSpaceSelector, word);
        await expect.poll(async () => (
          (await readFixture(userData)).nodes["node-composition-space"].source
        )).toBe(`공백: ${words.slice(0, words.indexOf(word) + 1).join(" ")} `);
      }
      await activateAtEnd(page, page.locator(componentSelector));

      await expect.poll(async () => (
        (await readFixture(userData)).nodes["node-composition-space"].source
      )).toBe("공백: 띄어쓰기가 자주 일어나도 중복되지 않는다 ");
    });

    await test.step("이전 저장이 반영돼도 진행 중인 다음 한글 조합의 caret을 덮어쓰지 않는다", async () => {
      const target = page.locator(compositionCaretSelector);
      await activateAtEnd(page, target);
      const cdp = await page.context().newCDPSession(page);
      await insertComposedText(cdp, "가");
      await cdp.send("Input.imeSetComposition", {
        text: "나",
        selectionStart: 1,
        selectionEnd: 1,
      });
      await page.waitForTimeout(250);

      await expect.poll(async () => target.evaluate((element) => {
        const editable = element.querySelector<HTMLElement>('[contenteditable="true"]');
        const selection = window.getSelection();
        if (!editable || !selection?.rangeCount) return undefined;
        const suffix = document.createRange();
        suffix.setStart(selection.anchorNode!, selection.anchorOffset);
        suffix.setEndAfter(editable.lastChild!);
        return {
          composing: editable.dataset.markdownComposing,
          suffixAfterCaret: suffix.toString().replaceAll("\u200b", ""),
        };
      })).toEqual({ composing: "true", suffixAfterCaret: "" });

      await cdp.send("Input.insertText", { text: "나" });
      await activateAtEnd(page, page.locator(componentSelector));
      await expect.poll(async () => (
        (await readFixture(userData)).nodes["node-composition-caret"].source
      )).toBe("경쟁: 가나");
    });

    await test.step("빈 Markdown의 첫 한글 조합도 동일한 흐름으로 한 번만 저장한다", async () => {
      await activateAtEnd(page, page.locator(emptyCompositionSelector));
      await dispatchCompositionCommit(page, emptyCompositionSelector, "첫 입력", true);
      await activateAtEnd(page, page.locator(componentSelector));

      await expect.poll(async () => (
        (await readFixture(userData)).nodes["node-empty-composition"].source
      )).toBe("첫 입력");
    });

    await test.step("여러 한글 음절과 공백을 빠르게 연속 확정해도 원문이 중복되지 않는다", async () => {
      await activateAtEnd(page, page.locator(compositionBurstSelector));
      const cdp = await page.context().newCDPSession(page);
      const phrase = "것인데 정말로 해볼 수 있다는";
      for (const character of phrase) {
        if (character === " ") await page.keyboard.press("Space");
        else await insertComposedText(cdp, character);
      }
      await activateAtEnd(page, page.locator(componentSelector));

      await expect.poll(async () => (
        (await readFixture(userData)).nodes["node-composition-burst"].source
      )).toBe(`연속: ${phrase}`);
    });

    await test.step("IME가 직전 조합 글자를 교체하면 target range만 바꾸고 중복 추가하지 않는다", async () => {
      await activateAtEnd(page, page.locator(compositionReplacementSelector));
      await dispatchCompositionReplacement(page, compositionReplacementSelector, "ㅎ", "하");
      await activateAtEnd(page, page.locator(componentSelector));

      await expect.poll(async () => (
        (await readFixture(userData)).nodes["node-composition-replacement"].source
      )).toBe("치환: 하");
    });

    await test.step("인라인 자동 서식은 한 번의 undo와 redo로 왕복한다", async () => {
      await activateAtEnd(page, page.locator(directSelector));
      await page.keyboard.press("Enter");
      await insertSequentially(page, "**");
      await page.keyboard.insertText("굵게");
      await insertSequentially(page, "**");
      await expect(page.locator(`${directSelector} strong`)).toHaveCount(1);
      await page.keyboard.press("Meta+z");
      await expect(page.locator(`${directSelector} strong`)).toHaveCount(0);
      await page.keyboard.press("Meta+Shift+z");
      await expect(page.locator(`${directSelector} strong`)).toHaveCount(1);

      await activateAtEnd(page, page.locator(shortcutSelector));
      await page.keyboard.press("Meta+b");
      await page.keyboard.insertText("단축키");
      await expect(page.locator(`${shortcutSelector} strong`)).toContainText("단축키");

      await activateAtEnd(page, page.locator(pasteSelector));
      await page.evaluate((text) => {
        const editable = document.activeElement?.closest('[contenteditable="true"]');
        if (!editable) throw new Error("paste 대상 Markdown 편집기를 찾지 못했습니다.");
        const data = new DataTransfer();
        data.setData("text/plain", text);
        editable.dispatchEvent(new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: data,
        }));
      }, "**붙여넣기 원문**");
      await activateAtEnd(page, page.locator(componentSelector));
      await expect.poll(async () => (await readFixture(userData)).nodes["node-shortcut"].source).toBe("**단축키**");
      await expect.poll(async () => (await readFixture(userData)).nodes["node-paste"].source).toBe("\\*\\*붙여넣기 원문\\*\\*");
    });

    await test.step("component prop과 repeater item prop은 독립적으로 저장된다", async () => {
      await activateAtEnd(page, page.locator(componentSelector));
      await page.keyboard.press("Enter");
      await page.keyboard.press("Minus");
      await page.keyboard.press("Space");
      await page.keyboard.insertText("컴포넌트 항목");

      await activateAtEnd(page, page.locator(repeaterASelector));
      await page.keyboard.press("Enter");
      await insertSequentially(page, "[]");
      await expect.poll(async () => (
        (await readFixture(userData)).nodes["node-repeater"].items[0].props["prop-markdown"]
      )).toBe("반복 A 시작\n\n\\[\\]");
      await page.keyboard.press("Space");
      await expect.poll(async () => (
        (await readFixture(userData)).nodes["node-repeater"].items[0].props["prop-markdown"]
      )).toBe("반복 A 시작\n\n- [ ] ");
      await page.keyboard.insertText("확인 항목");
      await page.locator(`${repeaterASelector} input[type="checkbox"]`).click();
      await activateAtEnd(page, page.locator(repeaterBSelector));

      await expect.poll(async () => {
        const document = await readFixture(userData);
        return {
          component: document.nodes["node-instance"].props["prop-markdown"],
          repeaterA: document.nodes["node-repeater"].items[0].props["prop-markdown"],
          repeaterB: document.nodes["node-repeater"].items[1].props["prop-markdown"],
          defaultValue: document.components["component-markdown-card"].propDefinitions[0].defaultValue,
        };
      }).toEqual({
        component: "컴포넌트 시작\n\n- 컴포넌트 항목",
        repeaterA: "반복 A 시작\n\n- [x] 확인 항목",
        repeaterB: "반복 B 유지",
        defaultValue: "컴포넌트 시작",
      });
    });

    await test.step("Markdown 외부 영역은 pagination 조각이 아니라 repeater item 전체를 선택한다", async () => {
      const itemFragments = page.locator(
        '.document-page-stack--screen [data-repeater-node-id="node-repeater"][data-repeater-item-id="item-a"]',
      );
      expect(await itemFragments.count()).toBeGreaterThan(1);
      const markdownOutsideEditableSurface = itemFragments.first().locator(
        '[data-document-edit-target="true"]',
      ).first();
      await markdownOutsideEditableSurface.dispatchEvent("mousedown");
      await markdownOutsideEditableSurface.dispatchEvent("click");

      await expect(page.locator('[data-document-edit-active="true"]')).toHaveCount(0);
      await expect.poll(() => itemFragments.evaluateAll((elements) => (
        elements.every((element) => element.getAttribute("data-document-selected") === "true")
      ))).toBe(true);
      const outline = page.locator(
        '[data-document-selection-outline="true"][data-document-selection-kind="repeater-item"]',
      );
      await expect(outline).toHaveCount(1);
      const geometry = await page.evaluate(() => {
        const selection = document.querySelector<HTMLElement>(
          '[data-document-selection-outline="true"][data-document-selection-kind="repeater-item"]',
        );
        const pageContent = selection?.parentElement;
        if (!selection || !pageContent) throw new Error("repeater item selection outline을 찾지 못했습니다.");
        const fragments = Array.from(pageContent.querySelectorAll<HTMLElement>(
          '[data-repeater-node-id="node-repeater"][data-repeater-item-id="item-a"]',
        ));
        const selectionBounds = selection.getBoundingClientRect();
        const fragmentBounds = fragments.map((fragment) => fragment.getBoundingClientRect());
        return {
          selection: {
            left: selectionBounds.left,
            top: selectionBounds.top,
            right: selectionBounds.right,
            bottom: selectionBounds.bottom,
          },
          union: {
            left: Math.min(...fragmentBounds.map((bounds) => bounds.left)),
            top: Math.min(...fragmentBounds.map((bounds) => bounds.top)),
            right: Math.max(...fragmentBounds.map((bounds) => bounds.right)),
            bottom: Math.max(...fragmentBounds.map((bounds) => bounds.bottom)),
          },
        };
      });
      expect(geometry.selection.left).toBeCloseTo(geometry.union.left, 0);
      expect(geometry.selection.top).toBeCloseTo(geometry.union.top, 0);
      expect(geometry.selection.right).toBeCloseTo(geometry.union.right, 0);
      expect(geometry.selection.bottom).toBeCloseTo(geometry.union.bottom, 0);
    });

    await test.step("pagination fragment와 한글 조합은 canonical source를 한 번만 바꾼다", async () => {
      const laterFragment = page.locator('[data-document-node-id="node-long"][data-document-edit-target="true"]:not([data-markdown-fragment-first="true"])').nth(1);
      await expect(laterFragment).toBeVisible();
      await activateAtEnd(page, laterFragment);
      await page.keyboard.insertText("경계확인");
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Input.imeSetComposition", { text: "ㅎ", selectionStart: 1, selectionEnd: 1 });
      await cdp.send("Input.imeSetComposition", { text: "한", selectionStart: 1, selectionEnd: 1 });
      await cdp.send("Input.insertText", { text: "한글 입력" });
      await activateAtEnd(page, page.locator(directSelector));

      await expect.poll(async () => {
        const source = (await readFixture(userData)).nodes["node-long"].source;
        return occurrences(source, "경계확인") === 1 &&
          occurrences(source, "한글 입력") === 1 &&
          !source.includes("ㅎ");
      }).toBe(true);
      await expect(page.locator('[data-document-edit-active="true"]')).toHaveCount(1);
    });

    await test.step("저장 후 앱을 다시 열어도 작성 결과가 유지된다", async () => {
      await page.getByRole("button", { name: "문서 목록" }).click();
      await expect(page.getByText("로컬 문서 보관함")).toBeVisible();
      await application?.close();
      application = undefined;

      ({ application } = await launchApplication(userData));
      page = await application.firstWindow();
      await openFixture(page);
      await expect(page.locator(`${directSelector} h2`)).toContainText("사용자 흐름");
      await expect(page.locator(`${directSelector} strong`)).toContainText("굵게");
      await expect(page.locator(`${shortcutSelector} strong`)).toContainText("단축키");
      await expect(page.locator(`${repeaterASelector} input[type="checkbox"]`)).toBeChecked();
      await expect(page.locator('[data-document-edit-active="true"]')).toHaveCount(0);
    });

    await test.step("제품 PDF export handler가 실제 PDF를 만든다", async () => {
      await application.evaluate(async ({ dialog }, destination) => {
        dialog.showSaveDialog = async () => {
          await new Promise((resolve) => setTimeout(resolve, 3_000));
          return { canceled: false, filePath: destination };
        };
      }, pdfPath);

      await page.getByRole("button", { name: "PDF 내보내기" }).click();
      const printSurface = page.locator(".document-print-surface");
      await expect(printSurface).toBeAttached();
      await expect(printSurface).toContainText("사용자 흐름");
      await expect(printSurface).toContainText("컴포넌트 항목");
      await expect(printSurface).toContainText("확인 항목");
      await expect(printSurface).toContainText("한글 입력");
      await expect(printSurface.locator('input[type="checkbox"]').first()).toBeChecked();
      await expect(printSurface.locator('[data-document-selected="true"], [data-document-edit-active="true"], [role="listbox"]')).toHaveCount(0);
      await expect(page.getByText("PDF 저장 완료")).toBeVisible({ timeout: 20_000 });
      await expect.poll(async () => (await stat(pdfPath)).size).toBeGreaterThan(1_000);
      const signature = (await readFile(pdfPath)).subarray(0, 5).toString("ascii");
      expect(signature).toBe("%PDF-");
    });
  } finally {
    await application?.close().catch(() => undefined);
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

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

async function activateAtEnd(page: Page, targets: Locator): Promise<void> {
  const target = targets.last();
  await target.scrollIntoViewIfNeeded();
  const editable = target.locator('[contenteditable="true"]').first();
  const mapped = editable.locator('[data-markdown-source-map]').last();
  if (await mapped.count() && await mapped.isVisible()) {
    const box = await mapped.boundingBox();
    if (!box) throw new Error("Markdown source 위치를 화면에서 찾지 못했습니다.");
    await mapped.click({ position: { x: Math.max(1, box.width - 1), y: Math.max(1, box.height / 2) } });
  } else {
    await editable.click();
  }
  await expect(targets.filter({ has: page.locator(':scope[data-document-edit-active="true"]') })).toHaveCount(1);
}

async function setMarkdownCaretAtFirstText(target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  const mapped = target.locator('[data-markdown-source-map]').first();
  await mapped.click();
  await mapped.evaluate((element) => {
    const editable = element.closest<HTMLElement>('[contenteditable="true"]');
    const text = element.firstChild;
    if (!editable || !text) throw new Error("제목의 첫 text 위치를 찾지 못했습니다.");
    editable.focus();
    const range = document.createRange();
    range.setStart(text, 0);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
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

function occurrences(source: string, value: string): number {
  return source.split(value).length - 1;
}

async function insertSequentially(page: Page, value: string): Promise<void> {
  for (const character of value) {
    await page.keyboard.insertText(character);
    await page.waitForTimeout(80);
  }
}

async function dispatchEditingKey(
  page: Page,
  key: string,
  code: string,
  shiftKey = false,
): Promise<void> {
  await page.evaluate(({ key, code, shiftKey }) => {
    const target = document.activeElement;
    if (!(target instanceof HTMLElement) || target.contentEditable !== "true") {
      throw new Error("활성 Markdown contenteditable을 찾지 못했습니다.");
    }
    const handled = !target.dispatchEvent(new KeyboardEvent("keydown", {
      key,
      code,
      shiftKey,
      bubbles: true,
      cancelable: true,
    }));
    if (!handled) throw new Error(`${code} keydown을 Markdown 편집기가 처리하지 않았습니다.`);
  }, { key, code, shiftKey });
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

async function dispatchCompositionCommit(
  page: Page,
  selector: string,
  text: string,
  dispatchFinalEcho: boolean,
): Promise<void> {
  await page.locator(selector).evaluate((element, options) => {
    const editable = element.querySelector<HTMLElement>('[contenteditable="true"]');
    if (!editable) throw new Error("한글 조합 대상 Markdown 편집기를 찾지 못했습니다.");
    editable.dispatchEvent(new CompositionEvent("compositionstart", {
      bubbles: true,
      data: "",
    }));
    editable.dispatchEvent(new CompositionEvent("compositionend", {
      bubbles: true,
      data: options.text,
    }));
    if (options.dispatchFinalEcho) {
      editable.dispatchEvent(new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: options.text,
      }));
    }
  }, { text, dispatchFinalEcho });
}

async function dispatchSpaceTriggeredCompositionCommit(
  page: Page,
  selector: string,
  text: string,
): Promise<void> {
  await page.locator(selector).evaluate((element, committedText) => {
    const editable = element.querySelector<HTMLElement>('[contenteditable="true"]');
    if (!editable) throw new Error("한글 조합 대상 Markdown 편집기를 찾지 못했습니다.");
    editable.dispatchEvent(new CompositionEvent("compositionstart", {
      bubbles: true,
      data: "",
    }));
    editable.dispatchEvent(new CompositionEvent("compositionend", {
      bubbles: true,
      data: committedText,
    }));
    editable.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: " ",
      code: "Space",
    }));
    editable.dispatchEvent(new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: committedText,
    }));
    editable.dispatchEvent(new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: " ",
    }));
  }, text);
}

async function dispatchCompositionReplacement(
  page: Page,
  selector: string,
  previousText: string,
  replacement: string,
): Promise<void> {
  await page.locator(selector).evaluate((element, options) => {
    const editable = element.querySelector<HTMLElement>('[contenteditable="true"]');
    const segment = Array.from(
      editable?.querySelectorAll<HTMLElement>('[data-markdown-source-map]') ?? [],
    ).findLast((candidate) => candidate.textContent?.endsWith(options.previousText));
    const textNode = segment?.firstChild;
    if (!editable || !segment || !textNode) {
      throw new Error("한글 조합 교체 대상 source segment를 찾지 못했습니다.");
    }
    const end = textNode.textContent?.length ?? 0;
    const selection = window.getSelection();
    const caret = document.createRange();
    caret.setStart(textNode, end);
    caret.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(caret);

    editable.dispatchEvent(new CompositionEvent("compositionstart", {
      bubbles: true,
      data: options.previousText,
    }));
    const targetRange = new StaticRange({
      startContainer: textNode,
      startOffset: end - options.previousText.length,
      endContainer: textNode,
      endOffset: end,
    });
    editable.dispatchEvent(new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: false,
      inputType: "insertCompositionText",
      data: options.replacement,
      isComposing: true,
      targetRanges: [targetRange],
    }));
    editable.dispatchEvent(new CompositionEvent("compositionend", {
      bubbles: true,
      data: options.replacement,
    }));
  }, { previousText, replacement });
}
