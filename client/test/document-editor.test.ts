import * as Check from "./fixtures/assertions.ts";
import test from "node:test";
import assert from "node:assert/strict";
import {
  addComponentDefinition,
  addNode,
  archiveNode,
  createEmptyDocument,
  detachNodeStyle,
  moveNode,
  renameNode,
  updateNode,
  updateNodeStyle,
} from "../src/foundation/document.ts";
import {
  contentSelectionFromRenderTarget,
  documentInsertionParentId,
  documentSelectableNodeIds,
  reconcileDocumentSelection,
  selectComponentNode,
  selectNode,
  selectRepeaterItem,
  structureSelectionFromRenderTarget,
} from "../src/renderer/src/pages/document-editor/documentSelection.ts";
import { repeaterItemLabel } from "../src/renderer/src/pages/document-editor/repeaterItemPresentation.ts";
import {
  DEFAULT_PREVIEW_ZOOM,
  MAX_PREVIEW_ZOOM,
  MIN_PREVIEW_ZOOM,
  stepPreviewZoom,
} from "../src/renderer/src/pages/document-editor/previewZoom.ts";
import {
  autoLayoutDropPosition,
  childInsertionIndex,
  pixelsToPoints,
  roundLayoutPoint,
} from "../src/renderer/src/pages/document-editor/componentDirectManipulation.ts";

const fixedTime = "2026-10-09T00:00:00.000Z";
const options = {
  now: () => fixedTime,
  createId: (prefix: string) => `${prefix}-created`,
};

function emptyDocument() {
  return createEmptyDocument({
    documentId: "document-1",
    name: "Untitled",
    now: fixedTime,
    createId: () => "node-root",
  });
}

function textNode(id: string, value = "") {
  return { id, type: "text" as const, name: id, visible: true, value };
}

await test("editor transaction은 이름·node 속성·style을 불변 방식으로 갱신하고 분리한다", () => {
  const original = addNode(
    emptyDocument(),
    "node-root",
    { id: "node-image", type: "image" as const, name: "Image", visible: true, alt: "" },
    undefined,
    options,
  );
  const renamed = renameNode(original, "node-image", "Media", options);
  const updated = updateNode(renamed, "node-image", (node) => (
    node.type === "image" ? { ...node, alt: "Alternative" } : node
  ), options);
  const styled = updateNodeStyle(updated, "node-image", (style) => ({
    ...style,
    typography: { fontSizePt: 12, color: { kind: "hex" as const, value: "#123456" } },
    pagination: { keepTogether: true },
  }), options);

  assert.equal(Check.present(original.nodes["node-image"], 'fixture node').name, "Image");
  assert.equal(Check.field(Check.present(updated.nodes["node-image"], 'fixture node'), 'alt').alt, "Alternative");
  assert.equal(Check.present(styled.nodes["node-image"], 'fixture node').styleId, "style-created");
  assert.equal(Check.present(Check.present(styled.styles["style-created"], 'fixture value').typography, 'fixture value').fontSizePt, 12);

  const detached = detachNodeStyle(styled, "node-image", options);
  assert.equal(Check.present(detached.nodes["node-image"], 'fixture node').styleId, undefined);
  assert.equal(detached.styles["style-created"], undefined);
});

await test("stable node 선택은 순서 변경 뒤 유지되고 보관 뒤 해제된다", () => {
  let document = addNode(emptyDocument(), "node-root", textNode("node-a", "A"), undefined, options);
  document = addNode(document, "node-root", textNode("node-b", "B"), undefined, options);
  const selection = selectNode("node-a");

  document = moveNode(document, "node-a", "node-root", 1, options);
  assert.deepEqual(reconcileDocumentSelection(document, selection), selection);

  document = archiveNode(document, "node-a", options);
  assert.equal(reconcileDocumentSelection(document, selection), undefined);
});

await test("유효하지 않은 style 값은 문서에 반영되지 않는다", () => {
  const original = addNode(emptyDocument(), "node-root", textNode("node-a"), undefined, options);

  assert.throws(
    () => updateNodeStyle(original, "node-a", (style) => ({
      ...style,
      layout: { gapPt: -1 },
    }), options),
    /gapPt/,
  );
  assert.equal(Check.present(original.nodes["node-a"], 'fixture node').styleId, undefined);
  assert.equal(Object.keys(original.styles).length, 1);
  assert.equal(Check.present(original.styles[Check.present(Check.present(original.nodes[original.rootNodeId], 'fixture node').styleId, 'fixture key')], 'fixture object').name, "일반");
});

await test("preview 선택 대상은 document tree만 포함하고 component 정의 내부는 제외한다", () => {
  let document = addNode(emptyDocument(), "node-root", textNode("node-visible"), undefined, options);
  document = addComponentDefinition(document, {
    id: "component-1",
    name: "Reusable block",
    rootNodeId: "component-root",
    propDefinitions: [],
  }, {
    "component-root": {
      id: "component-root",
      type: "container" as const,
      name: "Definition root",
      visible: true,
      childIds: ["component-text"],
    },
    "component-text": textNode("component-text", "Definition"),
  }, options);

  const ids = documentSelectableNodeIds(document);
  assert.deepEqual([...ids], ["node-root", "node-visible"]);
  assert.equal(ids.has("component-root"), false);
  assert.equal(ids.has("component-text"), false);
});

await test("content 선택은 component 내부 render target을 데이터 소유 단위로 접는다", () => {
  const instanceTarget = {
    nodeId: "instance-a",
    componentNodeId: "component-label",
  };
  const itemTarget = {
    nodeId: "repeater-a",
    repeaterItemId: "item-a",
    componentNodeId: "component-label",
  };

  assert.deepEqual(contentSelectionFromRenderTarget(instanceTarget), selectNode("instance-a"));
  assert.deepEqual(
    contentSelectionFromRenderTarget(itemTarget),
    selectRepeaterItem("repeater-a", "item-a"),
  );
  assert.deepEqual(
    structureSelectionFromRenderTarget(instanceTarget),
    selectComponentNode("instance-a", "component-label"),
  );
  assert.deepEqual(
    structureSelectionFromRenderTarget(itemTarget),
    selectComponentNode("repeater-a", "component-label", "item-a"),
  );
});

await test("Document 요소 추가 위치는 선택한 container, 부모 container, root 순서로 결정한다", () => {
  let document = addNode(emptyDocument(), "node-root", {
    id: "node-section",
    type: "container" as const,
    name: "표시 이름은 위치 결정에 사용하지 않음",
    visible: true,
    childIds: [],
  }, undefined, options);
  document = addNode(document, "node-section", textNode("node-text", "Content"), undefined, options);
  document = addComponentDefinition(document, {
    id: "component-1",
    name: "Reusable block",
    rootNodeId: "component-root",
    propDefinitions: [],
  }, {
    "component-root": {
      id: "component-root",
      type: "container" as const,
      name: "Definition root",
      visible: true,
      childIds: [],
    },
  }, options);

  assert.equal(documentInsertionParentId(document), "node-root");
  assert.equal(documentInsertionParentId(document, "node-section"), "node-section");
  assert.equal(documentInsertionParentId(document, "node-text"), "node-section");
  assert.equal(documentInsertionParentId(document, "component-root"), "node-root");
  assert.equal(documentInsertionParentId(document, "component-root", "component-root"), "component-root");

  const archived = archiveNode(document, "node-text", options);
  assert.equal(documentInsertionParentId(archived, "node-text"), "node-root");
});

await test("repeater item 선택은 item id로 유지되고 실제 항목 데이터로 레이어 이름을 만든다", () => {
  let document = addComponentDefinition(emptyDocument(), {
    id: "component-education",
    name: "Education item",
    rootNodeId: "component-root",
    propDefinitions: [{
      id: "prop-school",
      name: "학교",
      status: "active" as const,
      valueType: "text",
      defaultValue: "기본 학교",
      binding: { nodeId: "component-text", property: "text.value" },
    }],
  }, {
    "component-root": {
      id: "component-root",
      type: "container" as const,
      name: "Item root",
      visible: true,
      childIds: ["component-text"],
    },
    "component-text": textNode("component-text"),
  }, options);
  document = addNode(document, "node-root", {
    id: "node-education",
    type: "repeater" as const,
    name: "교육",
    visible: true,
    itemComponentId: "component-education",
    items: [
      { id: "item-1", componentId: "component-education", visible: true, props: { "prop-school": "한국대학교" } },
      { id: "item-2", componentId: "component-education", visible: true, props: {} },
    ],
  }, undefined, options);

  const repeater = Check.present(document.nodes["node-education"], 'fixture binding');
  const selection = selectRepeaterItem(Check.present(repeater, 'fixture node').id, "item-2");
  assert.deepEqual(reconcileDocumentSelection(document, selection), selection);
  const componentNodeSelection = selectComponentNode(Check.present(repeater, 'fixture node').id, "component-text", "item-2");
  assert.deepEqual(reconcileDocumentSelection(document, componentNodeSelection), componentNodeSelection);
  assert.equal(
    reconcileDocumentSelection(document, selectComponentNode(Check.present(repeater, 'fixture node').id, "unknown-node", "item-2")),
    undefined,
  );
  assert.equal(
    reconcileDocumentSelection(document, selectComponentNode(Check.present(repeater, 'fixture node').id, "component-text")),
    undefined,
  );
  assert.equal(repeaterItemLabel(document, Check.asNode(repeater, "repeater"), Check.present(Check.asNode(repeater, 'repeater').items[0], 'first repeater item'), 0), "항목 1 · 한국대학교");
  assert.equal(repeaterItemLabel(document, Check.asNode(repeater, "repeater"), Check.present(Check.asNode(repeater, 'repeater').items[1], 'second repeater item'), 1), "항목 2 · 기본 학교");

  const withoutSecondItem = {
    ...document,
    nodes: {
      ...document.nodes,
      [Check.present(repeater, 'fixture node').id]: { ...Check.asNode(repeater, 'repeater'), items: Check.asNode(repeater, 'repeater').items.slice(0, 1) },
    },
  };
  assert.equal(reconcileDocumentSelection(withoutSecondItem, selection), undefined);
  assert.equal(reconcileDocumentSelection(withoutSecondItem, componentNodeSelection), undefined);
});

await test("preview zoom은 8%씩 이동하고 50~115% 범위를 넘지 않는다", () => {
  assert.equal(stepPreviewZoom(DEFAULT_PREVIEW_ZOOM, -1), 0.7);
  assert.equal(stepPreviewZoom(DEFAULT_PREVIEW_ZOOM, 1), 0.86);
  assert.equal(stepPreviewZoom(MIN_PREVIEW_ZOOM, -1), MIN_PREVIEW_ZOOM);
  assert.equal(stepPreviewZoom(MAX_PREVIEW_ZOOM, 1), MAX_PREVIEW_ZOOM);
  assert.equal(stepPreviewZoom(1.1, 1), MAX_PREVIEW_ZOOM);
});

await test("component Auto Layout drag는 포인터 위치를 형제 삽입 위치로 변환한다", () => {
  const rects = [
    { start: 10, end: 30 },
    { start: 40, end: 60 },
    { start: 70, end: 90 },
  ];
  assert.equal(autoLayoutDropPosition(5, rects), 0);
  assert.equal(autoLayoutDropPosition(35, rects), 1);
  assert.equal(autoLayoutDropPosition(95, rects), 3);

  assert.equal(
    childInsertionIndex(["a", "dragged", "hidden", "b", "c"], "dragged", ["a", "b", "c"], 2),
    3,
  );
  assert.equal(
    childInsertionIndex(["a", "dragged", "b"], "dragged", ["a", "b"], 0),
    0,
  );
});

await test("component 자유 배치 drag는 CSS pixel 이동량을 pt 좌표로 변환한다", () => {
  assert.equal(pixelsToPoints(96), 72);
  assert.equal(roundLayoutPoint(pixelsToPoints(13)), 9.8);
});
