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

test("새 문서는 값이 포함된 일반 root style로 시작한다", () => {
  let index = 0;
  const document = createEmptyDocument({
    documentId: "document-1",
    now: "2026-10-10T00:00:00.000Z",
    createId: (prefix) => `${prefix}-${++index}`,
  });
  const root = document.nodes[document.rootNodeId];
  const style = document.styles[root.styleId];

  assert.equal(style.name, "일반");
  assert.equal(style.layout.gapPt, 8);
  assert.equal(style.typography.fontSizePt, 8);
  assert.equal(style.typography.lineHeight, 1.57);
  assert.equal(matchesDocumentStylePreset(style, "regular"), true);
});

test("조밀 preset은 registry ID 없이 기존 style ID에 값을 복사한다", () => {
  const original = createDocumentStyleFromPreset("regular", "style-root");
  const compact = applyDocumentStylePreset(original, "compact");

  assert.equal(compact.id, "style-root");
  assert.equal(compact.name, "조밀");
  assert.equal(compact.layout.gapPt, 5.5);
  assert.equal(compact.typography.fontSizePt, 7.5);
  assert.equal(compact.typography.lineHeight, 1.5);
  assert.equal("presetId" in compact, false);
  assert.equal(matchesDocumentStylePreset(compact, "compact"), true);
  assert.equal(matchesDocumentStylePreset(original, "regular"), true);
});

test("preset 결과와 공개 preset 값은 서로 독립적이다", () => {
  const style = createDocumentStyleFromPreset("regular", "style-root");
  style.typography.fontSizePt = 11;

  assert.equal(DOCUMENT_STYLE_PRESETS[0].style.typography.fontSizePt, 8);
  assert.equal(matchesDocumentStylePreset(style, "regular"), false);
});

test("root style 값은 Markdown 계층에도 같은 밀도로 전달된다", () => {
  const css = styleToCss(createDocumentStyleFromPreset("compact", "style-root"));

  assert.equal(css.fontSize, "7.5pt");
  assert.equal(css.gap, "5.5pt");
  assert.equal(css["--markdown-body-size"], "7.5pt");
  assert.equal(css["--markdown-block-gap"], "5.5pt");
  assert.equal(css["--markdown-h1-size"], "15pt");
  assert.equal(css["--markdown-code-size"], "6.9375pt");
});
