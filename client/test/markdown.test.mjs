import test from "node:test";
import assert from "node:assert/strict";
import {
  clearMarkdownBlockCache,
  parseMarkdownBlocks,
  parseMarkdownInline,
  parseMarkdownTree,
} from "../src/renderer/src/pages/document-editor/markdown/parser.ts";
import {
  contentBlocksToMarkdown,
  textContentToMarkdown,
} from "../src/main/document/legacy/markdownSerialization.ts";

test("빈 중첩 불릿은 Setext 제목이 아니라 편집 가능한 목록 항목으로 파싱한다", () => {
  const source = "- 상위\n    - 하위\n        - \n\n# 다음 제목";
  const blocks = parseMarkdownBlocks(source);
  const rootList = blocks[0].node;

  assert.equal(blocks.length, 2);
  assert.equal(rootList.type, "list");
  const firstNestedList = rootList.children[0].children[1];
  assert.equal(firstNestedList.type, "list");
  const secondNestedList = firstNestedList.children[0].children[1];
  assert.equal(secondNestedList.type, "list");
  const emptyItem = secondNestedList.children[0];
  assert.equal(emptyItem.type, "listItem");
  assert.deepEqual(emptyItem.children, []);
  assert.equal(emptyItem.position.start.offset, source.lastIndexOf("- "));
  assert.equal(emptyItem.position.end.offset, source.indexOf("\n\n"));
  assert.equal(blocks[1].node.type, "heading");
  assert.equal(blocks[1].node.position.start.offset, source.indexOf("# 다음 제목"));
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

test("동일 Markdown source는 parse 결과를 screen·measure에서 재사용한다", () => {
  clearMarkdownBlockCache();
  const source = "### 제목\n\n본문입니다.";
  const screenBlocks = parseMarkdownBlocks(source);
  const measureBlocks = parseMarkdownBlocks(source);
  const changedBlocks = parseMarkdownBlocks(`${source}\n`);

  assert.equal(measureBlocks, screenBlocks);
  assert.notEqual(changedBlocks, screenBlocks);
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
