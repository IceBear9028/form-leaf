import test from "node:test";
import assert from "node:assert/strict";
import {
  markdownTextSegments,
  markdownEditableBlankLineOffsets,
  parseMarkdownBlocks,
  parseMarkdownInline,
  parseMarkdownTree,
} from "../src/renderer/src/pages/document-editor/markdown/parser.ts";
import {
  contentBlocksToMarkdown,
  textContentToMarkdown,
} from "../src/main/document/legacy/markdownSerialization.ts";
import {
  replaceMarkdownRange,
  replaceMarkdownText,
  replaceMarkdownTextWithBlockShortcut,
  toggleMarkdownBlockquote,
  toggleMarkdownInlineFormat,
  toggleMarkdownLink,
} from "../src/renderer/src/pages/document-editor/markdown/edits.ts";
import { parseSourceMap } from "../src/renderer/src/pages/document-editor/markdown/sourceSelection.ts";

test("줄 시작 Markdown 접두어 뒤 Space를 블록 문법으로 전환한다", () => {
  const cases = [
    ["\\#", "# "],
    ["\\#\\#", "## "],
    ["\\#\\#\\#\\#\\#\\#", "###### "],
    ["\\-", "- "],
    ["\\>", "> "],
    ["1.", "1. "],
    ["23.", "23. "],
    ["앞 문단\n\n\\#", "앞 문단\n\n# "],
  ];

  for (const [source, expected] of cases) {
    const result = replaceMarkdownTextWithBlockShortcut(
      source,
      { start: source.length, end: source.length },
      " ",
      { start: 1, end: 1 },
    );
    assert.equal(result.source, expected);
    assert.deepEqual(result.selection, { start: expected.length, end: expected.length });
  }
});

test("문장 중간과 지원하지 않는 접두어는 일반 문자로 유지한다", () => {
  const middle = replaceMarkdownTextWithBlockShortcut(
    "내용 \\#",
    { start: 5, end: 5 },
    " ",
    { start: 1, end: 1 },
  );
  const unsupported = replaceMarkdownTextWithBlockShortcut(
    "\\#\\#\\#\\#\\#\\#\\#",
    { start: 14, end: 14 },
    " ",
    { start: 1, end: 1 },
  );

  assert.equal(middle.source, "내용 \\# ");
  assert.equal(unsupported.source, "\\#\\#\\#\\#\\#\\#\\# ");
});

test("선택한 문단을 인용문으로 전환하고 다시 해제한다", () => {
  const source = `### 개선\n\n기존 방식은 확인이 느렸습니다.\n두 번째 줄입니다.\n\n- 자동화했습니다.`;
  const start = source.indexOf("기존");
  const end = source.indexOf("\n\n- 자동화");
  const quoted = toggleMarkdownBlockquote(source, { start, end });

  assert.equal(quoted.source, `### 개선\n\n> 기존 방식은 확인이 느렸습니다.\n> 두 번째 줄입니다.\n\n- 자동화했습니다.`);
  assert.equal(parseMarkdownBlocks(quoted.source)[1].node.type, "blockquote");
  assert.equal(
    toggleMarkdownBlockquote(quoted.source, quoted.selection).source,
    source,
  );
});

test("DOM source map 문자열은 유효한 숫자 경계만 복원한다", () => {
  assert.deepEqual(parseSourceMap("0,1,2,NaN,4"), [0, 1, 2, 4]);
  assert.deepEqual(parseSourceMap(undefined), []);
});

test("본문을 페이지네이션 가능한 Markdown 블록으로 분리한다", () => {
  const source = `첫 문단입니다.
같은 문단의 다음 줄입니다.

### 검색 **성능** 개선

- 조건을 단순화했습니다.
- 캐시를 적용했습니다.
  같은 목록 항목의 다음 줄입니다.

# 이제 지원하는 큰 제목입니다.`;
  const blocks = parseMarkdownBlocks(source);

  assert.deepEqual(blocks.map((block) => block.node.type), [
    "paragraph",
    "heading",
    "list",
    "heading",
  ]);
  assert.deepEqual(blocks[0].node.children.map((node) => node.type), ["text", "break", "text"]);
  assert.equal(blocks[0].node.children[0].value, "첫 문단입니다.");
  assert.deepEqual(
    blocks[0].node.children.map((node) =>
      source.slice(node.position.start.offset, node.position.end.offset),
    ),
    ["첫 문단입니다.", "\n", "같은 문단의 다음 줄입니다."],
  );
  assert.equal(blocks[1].node.depth, 3);
  assert.deepEqual(blocks[1].node.children.map((node) => node.type), ["text", "strong", "text"]);
  assert.equal(blocks[2].node.ordered, false);
  assert.deepEqual(blocks[2].node.children[1].children[0].children.map((node) => node.type), [
    "text",
    "break",
    "text",
  ]);
  assert.equal(blocks[3].node.depth, 1);
});

test("인라인 강제 줄바꿈은 제목을 나누지 않고 같은 Markdown 블록에 유지한다", () => {
  const source = "### 첫 줄<br>둘째 줄";
  const blocks = parseMarkdownBlocks(source);

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].node.type, "heading");
  assert.deepEqual(blocks[0].node.children.map((node) => node.type), ["text", "html", "text"]);
  assert.equal(blocks[0].node.children[1].value, "<br>");
  assert.equal(blocks[0].node.children[1].position.start.offset, source.indexOf("<br>"));
  assert.equal(blocks[0].node.children[1].position.end.offset, source.indexOf("<br>") + 4);
});

test("문단 사이에 추가로 입력한 빈 줄 수를 보존한다", () => {
  const blocks = parseMarkdownBlocks(`첫 문단

두 번째 문단


세 번째 문단



### 제목`);

  assert.deepEqual(blocks.map((block) => block.extraBlankLinesBefore), [0, 0, 1, 2]);
});

test("공백이 섞인 문단 사이 빈 줄도 편집 가능한 source offset으로 계산한다", () => {
  const source = "첫 문단\n\n\n   \n\n두 번째 문단";
  const secondStart = source.indexOf("두 번째");

  assert.deepEqual(
    markdownEditableBlankLineOffsets(source, "첫 문단".length, secondStart, 2),
    [5, 6, 7],
  );
});

test("화면 텍스트를 이스케이프와 밑줄 marker를 제외한 원문 범위에 연결한다", () => {
  const source = "문자 \\*표시\\*와 ++밑줄++";
  const tree = parseMarkdownTree(source);
  const node = tree.children[0].children[0];
  const segments = markdownTextSegments(
    source,
    node.position.start.offset,
    node.position.end.offset,
    node.value,
  );

  assert.deepEqual(segments.map(({ text, underline }) => ({ text, underline })), [
    { text: "문자 *표시*와 ", underline: false },
    { text: "밑줄", underline: true },
  ]);
  assert.equal(source.slice(segments[0].sourceStart, segments[0].sourceEnd), "문자 \\*표시\\*와 ");
  assert.equal(source.slice(segments[1].sourceStart, segments[1].sourceEnd), "밑줄");
});

test("Markdown 원문 편집과 인라인 서식을 source range 트랜잭션으로 처리한다", () => {
  assert.deepEqual(replaceMarkdownRange("앞 내용 뒤", { start: 2, end: 4 }, "수정"), {
    source: "앞 수정 뒤",
    selection: { start: 4, end: 4 },
  });
  assert.deepEqual(replaceMarkdownText("본문", { start: 0, end: 2 }, "새 *본문*", { start: 2, end: 6 }), {
    source: "새 \\*본문\\*",
    selection: { start: 2, end: 8 },
  });

  const strong = toggleMarkdownInlineFormat("빠른 검색", { start: 0, end: 5 }, "strong");
  assert.equal(strong.source, "**빠른 검색**");
  assert.deepEqual(strong.selection, { start: 2, end: 7 });
  assert.deepEqual(toggleMarkdownInlineFormat(strong.source, strong.selection, "strong"), {
    source: "빠른 검색",
    selection: { start: 0, end: 5 },
  });

  const link = toggleMarkdownLink("문서 보기", { start: 0, end: 2 }, "https://example.com/a(b)");
  assert.equal(link.source, "[문서](https://example.com/a\\(b\\)) 보기");
  assert.deepEqual(toggleMarkdownLink(link.source, link.selection, "mailto:resume@example.com"), {
    source: "[문서](mailto:resume@example.com) 보기",
    selection: { start: 1, end: 3 },
  });
  assert.deepEqual(toggleMarkdownLink(link.source, link.selection), {
    source: "문서 보기",
    selection: { start: 0, end: 2 },
  });
});

test("CommonMark와 GFM의 기본 블록을 mdast 의미 구조로 보존한다", () => {
  const tree = parseMarkdownTree(`# H1

## H2

> 인용문

1. 순서 목록
   - 중첩 목록

---

\`인라인 코드\`와 *기울임*, ~~취소선~~, ![이미지](https://example.com/image.png)

\`\`\`ts
const value = 1
\`\`\`

| 이름 | 값 |
| --- | ---: |
| 속도 | 30% |

- [x] 완료
- [ ] 대기`);

  assert.deepEqual(tree.children.map((node) => node.type), [
    "heading",
    "heading",
    "blockquote",
    "list",
    "thematicBreak",
    "paragraph",
    "code",
    "table",
    "list",
  ]);
  assert.equal(tree.children[3].ordered, true);
  assert.equal(tree.children[3].children[0].children[1].type, "list");
  assert.deepEqual(tree.children[5].children.map((node) => node.type), [
    "inlineCode",
    "text",
    "emphasis",
    "text",
    "delete",
    "text",
    "image",
  ]);
  assert.equal(tree.children[6].lang, "ts");
  assert.deepEqual(tree.children[8].children.map((item) => item.checked), [true, false]);
});

test("참조 링크와 각주 정의를 본문과 분리해 보존한다", () => {
  const tree = parseMarkdownTree(`자세한 내용은 [문서][guide]와 각주[^note]를 확인합니다.

[guide]: https://example.com "가이드"
[^note]: 보충 설명입니다.`);

  assert.deepEqual(tree.children.map((node) => node.type), [
    "paragraph",
    "definition",
    "footnoteDefinition",
  ]);
  assert.deepEqual(tree.children[0].children.map((node) => node.type), [
    "text",
    "linkReference",
    "text",
    "footnoteReference",
    "text",
  ]);
  assert.equal(tree.children[1].url, "https://example.com");
  assert.equal(tree.children[2].children[0].type, "paragraph");
});

test("굵게, 밑줄과 링크를 중첩해 파싱한다", () => {
  const content = parseMarkdownInline("[**++강조된 링크++**](https://example.com/a\\(b\\))");
  assert.deepEqual(content.runs, [{
    text: "강조된 링크",
    marks: ["strong", "underline", "link"],
    href: "https://example.com/a(b)",
  }]);
});

test("이스케이프된 Markdown 문자를 원문으로 보존한다", () => {
  const content = parseMarkdownInline("\\*별표\\* \\+더하기\\+ \\[괄호\\]");
  assert.deepEqual(content.runs, [{ text: "*별표* +더하기+ [괄호]" }]);
});

test("TextContent를 Markdown으로 옮긴 뒤 텍스트와 mark를 복원한다", () => {
  const original = {
    runs: [
      { text: "원문 [문자] " },
      { text: "강조", marks: ["strong", "underline"] },
      { text: " 링크", marks: ["link"], href: "https://example.com/a(b)" },
    ],
  };
  const markdown = textContentToMarkdown(original);
  const restored = parseMarkdownInline(markdown);

  assert.equal(markdown, "원문 \\[문자\\] **++강조++**[ 링크](https://example.com/a\\(b\\))");
  assert.deepEqual(restored, original);
});

test("v1 성과 상세를 소제목, 문단과 목록 순서로 직렬화한다", () => {
  const markdown = contentBlocksToMarkdown([{
    id: "detail-1",
    type: "detail",
    title: { runs: [{ text: "검색 성능 개선" }] },
    context: { runs: [{ text: "응답이 느려졌습니다." }] },
    actions: [
      { runs: [{ text: "검색 조건을 단순화했습니다." }] },
      { runs: [{ text: "캐시를 적용했습니다." }] },
    ],
    result: { runs: [{ text: "응답 시간을 단축했습니다.", marks: ["strong"] }] },
  }]);

  assert.equal(markdown, `### 검색 성능 개선

> 응답이 느려졌습니다.

- 검색 조건을 단순화했습니다.
- 캐시를 적용했습니다.
- **응답 시간을 단축했습니다.**`);
  assert.deepEqual(parseMarkdownBlocks(markdown).map((block) => block.node.type), [
    "heading",
    "blockquote",
    "list",
  ]);
});

test("원문 HTML은 실행하지 않고 렌더러가 텍스트로 다룰 mdast 노드로 유지한다", () => {
  const blocks = parseMarkdownBlocks("<script>alert('x')</script>");
  assert.equal(blocks[0].node.type, "html");
  assert.equal(blocks[0].node.value, "<script>alert('x')</script>");
});
