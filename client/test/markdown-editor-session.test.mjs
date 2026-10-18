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

test("Markdown editor session은 구조화 state를 Markdown snapshot으로 직렬화한다", () => {
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

test("editor transaction만 revision과 publish snapshot을 전진시킨다", () => {
  const published = [];
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

test("손실 가능한 Markdown은 editor 진입 전에 거부한다", () => {
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

test("기존 br 표기는 editor hard break로 의미를 보존해 정규화한다", () => {
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

test("top-level block snapshot만 full Markdown source에 반영한다", () => {
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

test("session 시작 뒤 full source가 달라지면 stale block range로 덮어쓰지 않는다", () => {
  const source = "# 제목\n\n본문";
  const slice = createMarkdownEditorBlockSlice(source, 1);
  assert.ok(slice);

  assert.deepEqual(
    replaceMarkdownEditorBlock("# 외부 변경\n\n본문", slice, "편집 내용"),
    { type: "conflict", currentSource: "# 외부 변경\n\n본문" },
  );
});
