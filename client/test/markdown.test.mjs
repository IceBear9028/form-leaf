import test from "node:test";
import assert from "node:assert/strict";
import {
  clearMarkdownBlockCache,
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
  applyMarkdownCommand,
  applyMarkdownQuickInsertCommand,
  clearMarkdownFormatting,
  deleteMarkdownBackwardAtBlockStart,
  findMarkdownQuickInsertTrigger,
  indentMarkdownListItem,
  insertMarkdownParagraphBreak,
  insertMarkdownTextWithFormats,
  markdownEmptyListItemCaretOffset,
  replaceMarkdownRange,
  replaceMarkdownText,
  replaceMarkdownTextWithBlockShortcut,
  replaceMarkdownTextWithInputRules,
  setMarkdownTaskItemChecked,
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

test("이미 적용된 제목의 첫 글자 앞에서 heading marker를 다시 입력하면 level을 변경한다", () => {
  const cases = [
    { source: "# 제목", caret: 2, typed: "## ", expected: "## 제목", expectedCaret: 3 },
    { source: "## 제목", caret: 3, typed: "### ", expected: "### 제목", expectedCaret: 4 },
    { source: "#### 제목", caret: 5, typed: "# ", expected: "# 제목", expectedCaret: 2 },
    { source: "  ## 제목", caret: 5, typed: "###### ", expected: "  ###### 제목", expectedCaret: 9 },
  ];

  for (const testCase of cases) {
    let source = testCase.source;
    let caret = testCase.caret;
    for (const character of testCase.typed) {
      const result = replaceMarkdownTextWithInputRules(
        source,
        { start: caret, end: caret },
        character,
        { start: character.length, end: character.length },
        "typing",
      );
      source = result.source;
      caret = result.selection.end;
    }
    assert.equal(source, testCase.expected);
    assert.equal(caret, testCase.expectedCaret);
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

test("연속 Space 입력은 Markdown source에서 공백 수를 그대로 보존한다", () => {
  let source = "앞";
  let caret = source.length;
  for (let index = 0; index < 3; index += 1) {
    const result = replaceMarkdownTextWithInputRules(
      source,
      { start: caret, end: caret },
      " ",
      { start: 1, end: 1 },
      "typing",
    );
    source = result.source;
    caret = result.selection.end;
  }
  const result = replaceMarkdownTextWithInputRules(
    source,
    { start: caret, end: caret },
    "뒤",
    { start: 1, end: 1 },
    "typing",
  );
  assert.equal(result.source, "앞   뒤");
});

test("Jira형 block shortcut은 불릿·번호·작업 항목 문법을 마지막 Space에서 전환한다", () => {
  const cases = [
    ["\\*", "* "],
    ["2)", "2) "],
    ["\\[\\]", "- [ ] "],
  ];

  for (const [source, expected] of cases) {
    const result = replaceMarkdownTextWithInputRules(
      source,
      { start: source.length, end: source.length },
      " ",
      { start: 1, end: 1 },
      "typing",
    );
    assert.equal(result.source, expected);
    assert.deepEqual(result.selection, { start: expected.length, end: expected.length });
  }
});

test("Jira형 구분선과 code block은 마지막 marker 입력에서 편집 가능한 구조를 만든다", () => {
  const cases = [
    ["\\-\\-", "-", "---\n\n", 5],
    ["\\*\\*", "*", "***\n\n", 5],
    ["\\`\\`", "`", "```\n\n```", 4],
  ];

  for (const [source, input, expected, selection] of cases) {
    assert.deepEqual(
      replaceMarkdownTextWithInputRules(
        source,
        { start: source.length, end: source.length },
        input,
        { start: 1, end: 1 },
        "typing",
      ),
      { source: expected, selection: { start: selection, end: selection } },
    );
  }
});

test("순차 inline Markdown은 마지막 marker에서 서식 source로 전환하고 paste는 literal로 보존한다", () => {
  const cases = [
    ["\\*\\*굵게\\*", "*", "**굵게**"],
    ["\\*기울임", "*", "*기울임*"],
    ["\\~\\~취소선\\~", "~", "~~취소선~~"],
    ["\\`코드", "`", "`코드`"],
    ["\\[링크\\](https://example.com", ")", "[링크](https://example.com)"],
    ["\\[링크\\](www.example.com", ")", "[링크](https://www.example.com)"],
  ];

  for (const [source, input, expected] of cases) {
    const result = replaceMarkdownTextWithInputRules(
      source,
      { start: source.length, end: source.length },
      input,
      { start: 1, end: 1 },
      "typing",
    );
    assert.equal(result.source, expected);
  }

  const pasted = replaceMarkdownTextWithInputRules(
    "",
    { start: 0, end: 0 },
    "**붙여넣기**",
    { start: 10, end: 10 },
    "paste",
  );
  assert.equal(pasted.source, "\\*\\*붙여넣기\\*\\*");

  const unfinishedStrong = replaceMarkdownTextWithInputRules(
    "\\*\\*굵게",
    { start: 8, end: 8 },
    "*",
    { start: 1, end: 1 },
    "typing",
  );
  assert.equal(unfinishedStrong.source, "\\*\\*굵게\\*");
});

test("목록 Enter는 다음 항목을 만들고 빈 최상위 항목에서는 목록을 종료한다", () => {
  assert.deepEqual(
    insertMarkdownParagraphBreak("- 첫 항목", { start: 6, end: 6 }),
    { source: "- 첫 항목\n- ", selection: { start: 9, end: 9 } },
  );
  assert.deepEqual(
    insertMarkdownParagraphBreak("2) 둘째", { start: 5, end: 5 }),
    { source: "2) 둘째\n3) ", selection: { start: 9, end: 9 } },
  );
  assert.deepEqual(
    insertMarkdownParagraphBreak("- 첫 항목\n- ", { start: 9, end: 9 }),
    { source: "- 첫 항목\n\n", selection: { start: 8, end: 8 } },
  );
  assert.deepEqual(
    insertMarkdownParagraphBreak("- [x] 완료", { start: 8, end: 8 }),
    { source: "- [x] 완료\n- [ ] ", selection: { start: 15, end: 15 } },
  );
  assert.deepEqual(
    insertMarkdownParagraphBreak("> 인용", { start: 4, end: 4 }),
    { source: "> 인용\n> ", selection: { start: 7, end: 7 } },
  );
  assert.deepEqual(
    insertMarkdownParagraphBreak("  - ", { start: 4, end: 4 }),
    { source: "- ", selection: { start: 2, end: 2 } },
  );
});

test("빈 목록 caret은 marker 뒤 content 시작 offset을 가리킨다", () => {
  assert.equal(markdownEmptyListItemCaretOffset("- ", 0, 1), 2);
  assert.equal(markdownEmptyListItemCaretOffset("2) ", 0, 1), 3);
  assert.equal(markdownEmptyListItemCaretOffset("  - [ ] ", 0, 3), 8);
});

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

test("작업 항목 checkbox는 해당 source marker만 변경한다", () => {
  const source = "- [ ] 첫째\n- [x] 둘째";
  assert.deepEqual(setMarkdownTaskItemChecked(source, 0, true), {
    source: "- [x] 첫째\n- [x] 둘째",
    selection: { start: 3, end: 3 },
  });
  assert.deepEqual(setMarkdownTaskItemChecked(source, 9, false), {
    source: "- [ ] 첫째\n- [ ] 둘째",
    selection: { start: 12, end: 12 },
  });
});

test("목록 시작 Backspace와 Tab은 내용을 잃지 않고 구조만 해제하거나 들여쓴다", () => {
  assert.deepEqual(
    deleteMarkdownBackwardAtBlockStart("- 항목", { start: 2, end: 2 }),
    { source: "항목", selection: { start: 0, end: 0 } },
  );
  assert.deepEqual(
    indentMarkdownListItem("- 첫째\n- 둘째", { start: 9, end: 9 }, "indent"),
    { source: "- 첫째\n    - 둘째", selection: { start: 13, end: 13 } },
  );
  assert.deepEqual(
    indentMarkdownListItem("- 첫째\n    - 둘째", { start: 13, end: 13 }, "outdent"),
    { source: "- 첫째\n- 둘째", selection: { start: 9, end: 9 } },
  );
  assert.deepEqual(
    indentMarkdownListItem("- 첫째", { start: 4, end: 4 }, "indent"),
    { source: "- 첫째", selection: { start: 4, end: 4 } },
  );
  assert.deepEqual(
    indentMarkdownListItem("- 첫째\n- 둘째\n- h", { start: 9, end: 9 }, "indent"),
    { source: "- 첫째\n    - 둘째\n- h", selection: { start: 13, end: 13 } },
  );
  assert.deepEqual(
    indentMarkdownListItem("1. 첫째\n2. 둘째\n# 아래 제목", { start: 11, end: 11 }, "indent"),
    { source: "1. 첫째\n    2. 둘째\n# 아래 제목", selection: { start: 15, end: 15 } },
  );
  assert.deepEqual(
    indentMarkdownListItem("100. 첫째\n2. 둘째", { start: 13, end: 13 }, "indent"),
    { source: "100. 첫째\n     2. 둘째", selection: { start: 18, end: 18 } },
  );
});

test("toolbar와 shortcut은 동일한 Markdown command로 블록 구조를 전환한다", () => {
  const unordered = applyMarkdownCommand(
    "첫 문단",
    { start: 2, end: 2 },
    { type: "list", style: "unordered" },
  );
  assert.deepEqual(unordered, {
    source: "- 첫 문단",
    selection: { start: 4, end: 4 },
  });
  assert.equal(
    applyMarkdownCommand(unordered.source, unordered.selection, {
      type: "list",
      style: "unordered",
    }).source,
    "첫 문단",
  );
  assert.equal(
    applyMarkdownCommand("- 첫 문단", { start: 4, end: 4 }, {
      type: "list",
      style: "ordered",
    }).source,
    "1. 첫 문단",
  );

  const heading = applyMarkdownCommand(
    "제목",
    { start: 0, end: 2 },
    { type: "heading", level: 2 },
  );
  assert.equal(heading.source, "## 제목");
  assert.equal(
    applyMarkdownCommand(heading.source, heading.selection, { type: "paragraph" }).source,
    "제목",
  );
  assert.deepEqual(
    applyMarkdownCommand("코드", { start: 0, end: 2 }, { type: "code-block" }),
    { source: "```\n코드\n```", selection: { start: 4, end: 6 } },
  );
  assert.deepEqual(
    applyMarkdownCommand("", { start: 0, end: 0 }, { type: "divider" }),
    { source: "---\n\n", selection: { start: 5, end: 5 } },
  );
});

test("빠른 삽입은 빈 줄의 slash query만 소비하고 같은 Markdown command를 실행한다", () => {
  const source = "앞 문단\n\n/제목";
  const trigger = findMarkdownQuickInsertTrigger(source, {
    start: source.length,
    end: source.length,
  });
  assert.deepEqual(trigger, {
    range: { start: 6, end: 9 },
    query: "제목",
  });
  assert.deepEqual(
    applyMarkdownQuickInsertCommand(source, trigger, { type: "heading", level: 2 }),
    { source: "앞 문단\n\n## ", selection: { start: 9, end: 9 } },
  );
  assert.equal(
    findMarkdownQuickInsertTrigger("문장 /제목", { start: 6, end: 6 }),
    undefined,
  );
  assert.equal(
    findMarkdownQuickInsertTrigger("/두 단어", { start: 5, end: 5 }),
    undefined,
  );
});

test("서식 지우기 command는 선택 내용은 보존하고 inline·block marker를 제거한다", () => {
  const source = "## ***강조***";
  const result = clearMarkdownFormatting(source, { start: 6, end: 8 });
  assert.deepEqual(result, {
    source: "강조",
    selection: { start: 0, end: 2 },
  });

  const linked = "[문서](https://example.com)";
  assert.deepEqual(
    clearMarkdownFormatting(linked, { start: 1, end: 3 }),
    { source: "문서", selection: { start: 0, end: 2 } },
  );
});

test("caret 서식은 다음 입력을 같은 inline command marker로 감싼다", () => {
  assert.deepEqual(
    insertMarkdownTextWithFormats("앞 ", { start: 2, end: 2 }, "굵게", ["strong"]),
    { source: "앞 **굵게**", selection: { start: 6, end: 6 } },
  );
  assert.deepEqual(
    insertMarkdownTextWithFormats("", { start: 0, end: 0 }, "중첩", ["strong", "emphasis"]),
    { source: "***중첩***", selection: { start: 5, end: 5 } },
  );

  assert.deepEqual(
    toggleMarkdownLink("", { start: 0, end: 0 }, "https://example.com"),
    { source: "[링크](https://example.com)", selection: { start: 1, end: 3 } },
  );
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
