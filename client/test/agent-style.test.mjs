import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDocument, addNode } from "../src/foundation/document.ts";
import { applyDocumentOperations } from "../src/main/application/documentOperationAdapter.ts";
import { styleToCss } from "../src/renderer/src/pages/document-editor/rendering/styleToCss.ts";
import { FontCatalog } from "../src/main/application/fontCatalog.ts";
const apply = (document, nodeId, patch) => applyDocumentOperations(document, [{ type: "update_node_style", nodeId, patch }], new Map(), new Set(["Installed Font"]));
function fixture() {
  let document = createEmptyDocument();
  document.styles.shared = { id: "shared", name: "공유", layout: { gapPt: 8, paddingPt: [1, 2, 3, 4], width: { mode: "fixed", valuePt: 100 } }, typography: { fontSizePt: 12, lineHeight: 1.5 }, decoration: { borderWidthPt: 1, borderEdges: ["top", "bottom"] } };
  for (const id of ["a", "b"]) document = addNode(document, document.rootNodeId, { id, type: "text", name: id, visible: true, styleId: "shared", value: "내용" });
  return document;
}
test("F06: 공유 style 사본·깊이 병합·배열 교체·leaf 삭제·CSS 의미", () => {
  const original = fixture();
  const changed = apply(original, "a", { layout: { gapPt: null, paddingPt: [5, 6, 7, 8], width: { mode: "fill" } }, typography: { fontSizePt: 18, fontFamily: "Installed Font" }, decoration: { borderEdges: ["left"] } });
  const styleId = changed.results[0].created.styleId; assert.notEqual(styleId, "shared");
  assert.equal(changed.document.nodes.a.styleId, styleId); assert.equal(changed.document.nodes.b.styleId, "shared");
  assert.deepEqual(changed.document.styles.shared, original.styles.shared);
  const style = changed.document.styles[styleId];
  assert.equal(style.layout.gapPt, undefined); assert.equal(style.typography.lineHeight, 1.5);
  assert.deepEqual(style.layout.width, { mode: "fill" }); assert.deepEqual(style.decoration.borderEdges, ["left"]);
  const css = styleToCss(style); assert.equal(css.fontSize, "18pt"); assert.equal(css.width, "100%"); assert.equal(css.borderLeftWidth, "1pt");
  const again = apply(changed.document, "a", { typography: { fontSizePt: 19 } });
  assert.equal(again.document.nodes.a.styleId, styleId); assert.equal(again.results[0].created, undefined);
});
test("F06: no-op은 style ID를 만들지 않고 unsupported font/token/필드/값을 거절한다", () => {
  let document = fixture();
  const noop = apply(document, "a", { typography: { fontSizePt: 12 } }); assert.deepEqual(noop.document, document); assert.equal(noop.results[0].created, undefined);
  document = addNode(document, document.rootNodeId, { id: "plain", type: "text", name: "plain", visible: true, value: "" });
  const noStyle = apply(document, "plain", { typography: { fontSizePt: null } }); assert.equal(noStyle.document.nodes.plain.styleId, undefined);
  for (const patch of [
    { typography: { fontFamily: "Uninstalled Font" } }, { typography: { color: { kind: "token", token: "unknown" } } },
    { layout: { gapPt: -1 } }, { typography: { fontSizePt: Infinity } }, { typography: null }, { css: "color:red" },
  ]) assert.throws(() => apply(document, "a", patch), (error) => error.detail.code === "VALIDATION_FAILED");
  const color = apply(document, "a", { typography: { color: { kind: "hex", value: "#112233" } } });
  assert.equal(styleToCss(color.document.styles[color.document.nodes.a.styleId]).color, "#112233");
});
test("F06: font catalog는 사용자 입력을 명령으로 실행하지 않고 알려진 fallback을 제공한다", async () => {
  const catalog = new FontCatalog(); const fonts = await catalog.families();
  assert.equal(fonts.has("sans-serif"), true); assert.equal(fonts.has("monospace"), true);
  assert.equal(fonts.has("url(https://example.com/font)"), false);
  assert.equal(await catalog.families(), fonts);
});
