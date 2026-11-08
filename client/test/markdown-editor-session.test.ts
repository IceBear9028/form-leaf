import * as Check from "./fixtures/assertions.ts";
import assert from "node:assert/strict";
import test from "node:test";
import {
  createMarkdownEditorSession,
  UnsupportedMarkdownEditorSourceError,
} from "../src/renderer/src/pages/document-editor/markdown/editor/MarkdownEditorSession.ts";
import {
  inspectMarkdownEditorCompatibility,
  prepareMarkdownForEditor,
} from "../src/renderer/src/pages/document-editor/markdown/editor/markdownEditorCompatibility.ts";
import {
  createMarkdownEditorBlockSlice,
  replaceMarkdownEditorBlock,
} from "../src/renderer/src/pages/document-editor/markdown/editor/markdownEditorBlockCodec.ts";

await test("Markdown editor session은 구조화 state를 Markdown snapshot으로 직렬화한다", () => {
  const source = `# 제목

일반 **굵게**와 *기울임*, ~~취소선~~, [링크](https://example.com), \`코드\`

- 첫 항목
    - 하위 항목
- [x] 완료
- [ ] 대기

> 인용문

---

\`\`\`ts
const value = 1
\`\`\``;
  const session = createMarkdownEditorSession({
    element: null,
    initialMarkdown: source,
  });

  try {
    assert.equal(session.snapshot().markdown, source.replace(
      "    - 하위 항목\n- [x] 완료",
      "    - 하위 항목\n\n- [x] 완료",
    ));
    assert.equal(session.snapshot().revision, 0);
  } finally {
    session.destroy();
  }
});

await test("editor transaction만 revision과 publish snapshot을 전진시킨다", () => {
  const published: import("../src/renderer/src/pages/document-editor/markdown/editor/MarkdownEditorSession.ts").MarkdownEditorSnapshot[] = [];
  const session = createMarkdownEditorSession({
    element: null,
    initialMarkdown: "기존 문장",
    onSnapshot: (snapshot) => published.push(snapshot),
  });

  try {
    session.editor.commands.command(({ dispatch, tr }) => {
      dispatch?.(tr.insertText("새 ", 1));
      return true;
    });

    assert.deepEqual(session.snapshot(), {
      markdown: "새 기존 문장",
      revision: 1,
    });
    assert.deepEqual(published, [{
      markdown: "새 기존 문장",
      revision: 1,
    }]);

    session.flush();
    assert.deepEqual(published.at(-1), session.snapshot());
  } finally {
    session.destroy();
  }
});

await test("손실 가능한 Markdown은 editor 진입 전에 거부한다", () => {
  assert.deepEqual(inspectMarkdownEditorCompatibility([
    "| A | B |",
    "| - | - |",
    "| 1 | 2 |",
    "",
    "![이미지](https://example.com/image.png)",
    "",
    "본문[^1]",
    "",
    "[^1]: 각주",
  ].join("\n")), {
    editable: false,
    unsupportedTypes: [
      "footnoteDefinition",
      "footnoteReference",
      "image",
      "table",
      "tableCell",
      "tableRow",
    ],
  });

  assert.throws(() => createMarkdownEditorSession({
    element: null,
    initialMarkdown: "![이미지](https://example.com/image.png)",
  }), (error) => (
    error instanceof UnsupportedMarkdownEditorSourceError &&
    error.unsupportedTypes.join(",") === "image"
  ));
});

await test("기존 br 표기는 editor hard break로 의미를 보존해 정규화한다", () => {
  const source = "- 첫째<br>둘째\n\n## 다음 제목";
  assert.deepEqual(inspectMarkdownEditorCompatibility(source), {
    editable: true,
    unsupportedTypes: [],
  });
  assert.equal(prepareMarkdownForEditor(source), "- 첫째  \n둘째\n\n## 다음 제목");

  const session = createMarkdownEditorSession({
    element: null,
    initialMarkdown: source,
  });
  try {
    assert.equal(session.snapshot().markdown, "- 첫째  \n둘째\n\n## 다음 제목");
  } finally {
    session.destroy();
  }
});

await test("top-level block snapshot만 full Markdown source에 반영한다", () => {
  const source = "# 제목\n\n- 첫째\n- 둘째\n\n마지막 문단";
  const slice = createMarkdownEditorBlockSlice(source, 1);
  assert.deepEqual(slice, {
    source,
    blockIndex: 1,
    range: { start: 6, end: 15 },
    markdown: "- 첫째\n- 둘째",
  });

  const result = replaceMarkdownEditorBlock(source, slice, "- 첫째\n    - 둘째\n- 셋째");
  assert.equal(result.type, "applied");
  if (result.type !== "applied") return;
  assert.equal(result.source, "# 제목\n\n- 첫째\n    - 둘째\n- 셋째\n\n마지막 문단");
  assert.deepEqual(result.slice.range, { start: 6, end: 24 });
  assert.equal(result.slice.markdown, "- 첫째\n    - 둘째\n- 셋째");
});

await test("session 시작 뒤 full source가 달라지면 stale block range로 덮어쓰지 않는다", () => {
  const source = "# 제목\n\n본문";
  const slice = createMarkdownEditorBlockSlice(source, 1);
  assert.ok(slice);

  assert.deepEqual(
    replaceMarkdownEditorBlock("# 외부 변경\n\n본문", slice, "편집 내용"),
    { type: "conflict" as const, currentSource: "# 외부 변경\n\n본문" },
  );
});


await test("늦게 도착한 acknowledgement는 selection·history·revision을 되돌리지 않는다", () => {
  const published: import("../src/renderer/src/pages/document-editor/markdown/editor/MarkdownEditorSession.ts").MarkdownEditorSnapshot[] = [];
  const session = createMarkdownEditorSession({
    element: null, initialMarkdown: "본문", onSnapshot: (value) => published.push(value),
  });
  try {
    assert.equal(session.receiveExternalSnapshot("본문"), "unchanged");
    session.editor.commands.command(({ tr, dispatch }) => { dispatch?.(tr.insertText("첫 ", 1)); return true; });
    session.editor.commands.command(({ tr, dispatch }) => { dispatch?.(tr.insertText("둘 ", 1)); return true; });
    const state = session.editor.state;
    assert.equal(session.receiveExternalSnapshot(Check.present(published[0], 'fixture value').markdown), "acknowledged");
    assert.equal(session.receiveExternalSnapshot("본문"), "acknowledged");
    assert.equal(session.receiveExternalSnapshot(Check.present(published[1], 'fixture value').markdown), "acknowledged");
    assert.equal(session.editor.state, state);
    assert.equal(session.snapshot().revision, 2);
    assert.equal(published.length, 2);
    // History plugins are mounted with EditorView; undo is exercised in Electron.
  } finally { session.destroy(); }
});

await test("실제 외부 snapshot은 보류하며 flush도 active state를 교체하지 않는다", () => {
  const session = createMarkdownEditorSession({ element: null, initialMarkdown: "본문" });
  try {
    session.editor.commands.command(({ tr, dispatch }) => { dispatch?.(tr.insertText("로컬 ", 1)); return true; });
    const state = session.editor.state;
    assert.equal(session.receiveExternalSnapshot("외부 본문"), "deferred");
    assert.equal(session.deferredExternalSnapshot(), "외부 본문");
    assert.deepEqual(session.flush(), { markdown: "로컬 본문", revision: 1 });
    assert.equal(session.editor.state, state);
  } finally { session.destroy(); }
});

await test("편집 없이 flush해도 원문의 표기를 정규화하여 publish하지 않는다", () => {
  const published: import("../src/renderer/src/pages/document-editor/markdown/editor/MarkdownEditorSession.ts").MarkdownEditorSnapshot[] = [];
  const session = createMarkdownEditorSession({ element: null, initialMarkdown: "* 항목", onSnapshot: (value) => published.push(value) });
  try {
    session.flush();
    assert.equal(published.length, 0);
    assert.equal(session.snapshot().revision, 0);
  } finally { session.destroy(); }
});


await test("reference block gate는 full source의 definition 문맥을 유지한다", () => {
  const source = "수정 가능\n\n[참조][ref]\n\n[ref]: https://example.com";
  assert.equal(inspectMarkdownEditorCompatibility(source, 0).editable, true);
  assert.deepEqual(inspectMarkdownEditorCompatibility(source, 1), { editable: false, unsupportedTypes: ["linkReference"] });
});


await test("block 전환은 flush 후 source range를 이동하고 외부 snapshot을 보류한다", async () => {
  const lifecycle = await import("../src/renderer/src/pages/document-editor/markdown/editor/markdownEditorLifecycle.ts");
  const { createEmptyDocument, addNode } = await import("../src/foundation/document.ts");
  const source = "# 제목\n\n본문\n\n마지막";
  const target = { kind: "node" as const, nodeId: "markdown" };
  let document = createEmptyDocument({ documentId: "lifecycle-test", name: "lifecycle", now: "2026-10-24T00:00:00Z", createId: () => "root" });
  document = addNode(document, document.rootNodeId, { id: "markdown", name: "Markdown", type: "markdown" as const, visible: true, source });
  try {
    const first = lifecycle.beginMarkdownBlock(target, source, 0);
    const order: string[] = [];
    lifecycle.registerMarkdownOwner({ flush: () => {
      order.push("flush");
      lifecycle.publishMarkdownBlock(Check.present(first, 'fixture value').slice, Check.present(first, 'fixture value').original, "# 긴 제목\n\n새 문단");
    }, close: () => order.push("close") });
    const second = lifecycle.beginMarkdownBlock(target, source, 2);
    assert.deepEqual(order, ["flush", "close"]);
    assert.equal(Check.present(second, 'fixture value').slice.markdown, "마지막");
    const result = lifecycle.publishMarkdownBlock(Check.present(second, 'fixture value').slice, Check.present(second, 'fixture value').original, "끝");
    assert.equal(Check.field(result, 'source').source, "# 긴 제목\n\n새 문단\n\n본문\n\n끝");
    const external = { ...document, nodes: { ...document.nodes, markdown: { ...Check.asNode(document.nodes.markdown, 'markdown'), source: "외부 변경" } } };
    assert.equal(Check.asNode(lifecycle.reconcileMarkdownDocumentUpdate(external).nodes.markdown, 'markdown').source, Check.field(result, 'source').source);
    assert.equal(lifecycle.getDeferredMarkdownSource(), "외부 변경");
    assert.equal(Check.asNode(lifecycle.pinnedMarkdownDocument(external).nodes.markdown, 'markdown').source, source);
  } finally { lifecycle.endMarkdownEditing(); }
});

await test("toolbar·quick insert·shortcut dispatcher는 같은 structured command를 실행한다", async () => {
  const { executeMarkdownEditorCommand } = await import("../src/renderer/src/pages/document-editor/markdown/editor/markdownEditorCommands.ts");
  const cases: Array<[import("../src/renderer/src/pages/document-editor/markdown/commandTypes.ts").MarkdownCommand, string]> = [
    [{ type: "heading" as const, level: 3 }, "### 본문"],
    [{ type: "blockquote" as const }, "> 본문"],
    [{ type: "list" as const, style: "unordered" }, "- 본문"],
    [{ type: "list" as const, style: "ordered" }, "1. 본문"],
    [{ type: "list" as const, style: "task" }, "- [ ] 본문"],
    [{ type: "code-block" as const }, "```\n본문\n```"],
    [{ type: "inline-format" as const, format: "strong" }, "**본문**"],
    [{ type: "inline-format" as const, format: "emphasis" }, "*본문*"],
    [{ type: "inline-format" as const, format: "underline" }, "++본문++"],
    [{ type: "inline-format" as const, format: "delete" }, "~~본문~~"],
    [{ type: "inline-format" as const, format: "inline-code" }, "`본문`"],
    [{ type: "link" as const, href: "https://example.com" }, "[본문](https://example.com)"],
  ];
  for (const [command, markdown] of cases) {
    const session = createMarkdownEditorSession({ element: null, initialMarkdown: "본문" });
    try {
      session.editor.commands.setTextSelection({ from: 1, to: 3 });
      assert.equal(executeMarkdownEditorCommand(session.editor, command), true);
      assert.equal(session.flush().markdown, markdown, JSON.stringify(command));
    } finally { session.destroy(); }
  }
});

await test("quick insert는 slash query만 삭제하고 heading을 만들며 clear command는 본문을 보존한다", async () => {
  const { executeMarkdownEditorCommand } = await import("../src/renderer/src/pages/document-editor/markdown/editor/markdownEditorCommands.ts");
  const session = createMarkdownEditorSession({ element: null, initialMarkdown: "/h2 본문" });
  try {
    executeMarkdownEditorCommand(session.editor, { type: "heading" as const, level: 2 }, { from: 1, to: 5 });
    assert.equal(session.flush().markdown, "## 본문");
    session.editor.commands.setTextSelection({ from: 1, to: 3 });
    executeMarkdownEditorCommand(session.editor, { type: "inline-format" as const, format: "strong" });
    executeMarkdownEditorCommand(session.editor, { type: "clear-formatting" as const });
    assert.equal(session.flush().markdown, "본문");
  } finally { session.destroy(); }
});


await test("CRLF 원문의 해당 block만 교체하고 앞뒤 byte 범위는 보존한다", () => {
  const source = "# 제목\r\n\r\n본문\r\n다음 줄\r\n\r\n마지막";
  const slice = Check.present(createMarkdownEditorBlockSlice(source, 1), 'fixture binding');
  assert.equal(Check.present(slice, 'fixture value').markdown, "본문\r\n다음 줄");
  const result = replaceMarkdownEditorBlock(source, slice, "새 본문");
  assert.equal(Check.field(result, 'source').source, "# 제목\r\n\r\n새 본문\r\n\r\n마지막");
});
