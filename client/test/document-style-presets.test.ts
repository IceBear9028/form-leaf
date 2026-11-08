import * as Check from "./fixtures/assertions.ts";
import test from "node:test";
import assert from "node:assert/strict";
import {
  applyDocumentStylePreset,
  createDocumentStyleFromPreset,
  createEmptyDocument,
  DOCUMENT_STYLE_PRESETS,
  matchesDocumentStylePreset,
} from "../src/foundation/document.ts";
import { styleToCss } from "../src/renderer/src/pages/document-editor/rendering/styleToCss.ts";

await test("새 문서는 값이 포함된 일반 root style로 시작한다", () => {
  let index = 0;
  const document = createEmptyDocument({
    documentId: "document-1",
    now: "2026-10-10T00:00:00.000Z",
    createId: (prefix) => `${prefix}-${++index}`,
  });
  const root = document.nodes[document.rootNodeId];
  const style = document.styles[Check.present(Check.present(root, 'fixture node').styleId, 'fixture key')];

  assert.equal(Check.present(style, 'fixture object').name, "일반");
  assert.equal(Check.present(Check.present(style, 'fixture value').layout, 'fixture object').gapPt, 8);
  assert.equal(Check.present(Check.present(style, 'fixture value').typography, 'fixture object').fontSizePt, 8.5);
  assert.equal(Check.present(Check.present(style, 'fixture value').typography, 'fixture object').lineHeight, 1.6);
  assert.equal(Check.present(Check.present(style, 'fixture value').markdown, 'fixture object').listItemGapPt, 2.5);
  assert.equal(matchesDocumentStylePreset(style, "regular"), true);
});

await test("조밀 preset은 registry ID 없이 기존 style ID에 값을 복사한다", () => {
  const original = createDocumentStyleFromPreset("regular", "style-root");
  const compact = applyDocumentStylePreset(original, "compact");

  assert.equal(compact.id, "style-root");
  assert.equal(compact.name, "조밀");
  assert.equal(Check.present(compact.layout, 'fixture value').gapPt, 5.5);
  assert.equal(Check.present(compact.typography, 'fixture value').fontSizePt, 7.5);
  assert.equal(Check.present(compact.typography, 'fixture value').lineHeight, 1.5);
  assert.equal("presetId" in compact, false);
  assert.equal(matchesDocumentStylePreset(compact, "compact"), true);
  assert.equal(matchesDocumentStylePreset(original, "regular"), true);
});

await test("preset 결과와 공개 preset 값은 서로 독립적이다", () => {
  const style = createDocumentStyleFromPreset("regular", "style-root");
  Check.present(style.typography, 'fixture value').fontSizePt = 11;

  assert.equal(Check.present(Check.present(DOCUMENT_STYLE_PRESETS[0], 'fixture value').style.typography, 'fixture value').fontSizePt, 8.5);
  assert.equal(matchesDocumentStylePreset(style, "regular"), false);
});

await test("root style 값은 Markdown 계층에도 같은 밀도로 전달된다", () => {
  const css = styleToCss(createDocumentStyleFromPreset("compact", "style-root"));

  assert.equal(Check.present(css, 'fixture value').fontSize, "7.5pt");
  assert.equal(Check.present(css, 'fixture value').gap, "5.5pt");
  assert.equal(Check.property(Check.present(css, "CSS result"), "--markdown-body-size"), "7.5pt");
  assert.equal(Check.property(Check.present(css, "CSS result"), "--markdown-block-gap"), "5.5pt");
  assert.equal(Check.property(Check.present(css, "CSS result"), "--markdown-h1-size"), "15pt");
  assert.equal(Check.property(Check.present(css, "CSS result"), "--markdown-code-size"), "6.9375pt");
});

await test("Markdown 목록 항목 간격을 CSS 변수로 전달한다", () => {
  const css = styleToCss({
    id: "style-list",
    name: "List",
    markdown: { listItemGapPt: 4 },
  });

  assert.equal(Check.property(Check.present(css, "CSS result"), "--markdown-list-gap"), "4pt");
});
