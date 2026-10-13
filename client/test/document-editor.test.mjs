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
  documentInsertionParentId,
  documentSelectableNodeIds,
  reconcileDocumentSelection,
  selectComponentNode,
  selectNode,
  selectRepeaterItem,
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
  createId: (prefix) => `${prefix}-created`,
};

function emptyDocument() {
  return createEmptyDocument({
    documentId: "document-1",
    name: "Untitled",
    now: fixedTime,
    createId: () => "node-root",
  });
}

function textNode(id, value = "") {
  return { id, type: "text", name: id, visible: true, value };
}

test("editor transaction은 이름·node 속성·style을 불변 방식으로 갱신하고 분리한다", () => {
  const original = addNode(
    emptyDocument(),
    "node-root",
    { id: "node-image", type: "image", name: "Image", visible: true, alt: "" },
    undefined,
    options,
  );
  const renamed = renameNode(original, "node-image", "Media", options);
  const updated = updateNode(renamed, "node-image", (node) => (
    node.type === "image" ? { ...node, alt: "Alternative" } : node
  ), options);
  const styled = updateNodeStyle(updated, "node-image", (style) => ({
    ...style,
    typography: { fontSizePt: 12, color: { kind: "hex", value: "#123456" } },
    pagination: { keepTogether: true },
  }), options);

  assert.equal(original.nodes["node-image"].name, "Image");
  assert.equal(updated.nodes["node-image"].alt, "Alternative");
  assert.equal(styled.nodes["node-image"].styleId, "style-created");
  assert.equal(styled.styles["style-created"].typography.fontSizePt, 12);

  const detached = detachNodeStyle(styled, "node-image", options);
  assert.equal(detached.nodes["node-image"].styleId, undefined);
  assert.equal(detached.styles["style-created"], undefined);
});

test("stable node 선택은 순서 변경 뒤 유지되고 보관 뒤 해제된다", () => {
  let document = addNode(emptyDocument(), "node-root", textNode("node-a", "A"), undefined, options);
  document = addNode(document, "node-root", textNode("node-b", "B"), undefined, options);
  const selection = selectNode("node-a");

  document = moveNode(document, "node-a", "node-root", 1, options);
  assert.deepEqual(reconcileDocumentSelection(document, selection), selection);

  document = archiveNode(document, "node-a", options);
  assert.equal(reconcileDocumentSelection(document, selection), undefined);
});

test("유효하지 않은 style 값은 문서에 반영되지 않는다", () => {
  const original = addNode(emptyDocument(), "node-root", textNode("node-a"), undefined, options);

  assert.throws(
    () => updateNodeStyle(original, "node-a", (style) => ({
      ...style,
      layout: { gapPt: -1 },
    }), options),
    /gapPt/,
  );
  assert.equal(original.nodes["node-a"].styleId, undefined);
  assert.equal(Object.keys(original.styles).length, 1);
  assert.equal(original.styles[original.nodes[original.rootNodeId].styleId].name, "일반");
});

test("preview 선택 대상은 document tree만 포함하고 component 정의 내부는 제외한다", () => {
  let document = addNode(emptyDocument(), "node-root", textNode("node-visible"), undefined, options);
  document = addComponentDefinition(document, {
    id: "component-1",
    name: "Reusable block",
    rootNodeId: "component-root",
    propDefinitions: [],
  }, {
    "component-root": {
      id: "component-root",
      type: "container",
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

test("Document 요소 추가 위치는 선택한 container, 부모 container, root 순서로 결정한다", () => {
  let document = addNode(emptyDocument(), "node-root", {
    id: "node-section",
    type: "container",
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
      type: "container",
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

test("repeater item 선택은 item id로 유지되고 실제 항목 데이터로 레이어 이름을 만든다", () => {
  let document = addComponentDefinition(emptyDocument(), {
    id: "component-education",
    name: "Education item",
    rootNodeId: "component-root",
    propDefinitions: [{
      id: "prop-school",
      name: "학교",
      status: "active",
      valueType: "text",
      defaultValue: "기본 학교",
      binding: { nodeId: "component-text", property: "text.value" },
    }],
  }, {
    "component-root": {
      id: "component-root",
      type: "container",
      name: "Item root",
      visible: true,
      childIds: ["component-text"],
    },
    "component-text": textNode("component-text"),
  }, options);
  document = addNode(document, "node-root", {
    id: "node-education",
    type: "repeater",
    name: "교육",
    visible: true,
    itemComponentId: "component-education",
    items: [
      { id: "item-1", componentId: "component-education", visible: true, props: { "prop-school": "한국대학교" } },
      { id: "item-2", componentId: "component-education", visible: true, props: {} },
    ],
  }, undefined, options);

  const repeater = document.nodes["node-education"];
  const selection = selectRepeaterItem(repeater.id, "item-2");
  assert.deepEqual(reconcileDocumentSelection(document, selection), selection);
  const componentNodeSelection = selectComponentNode(repeater.id, "component-text", "item-2");
  assert.deepEqual(reconcileDocumentSelection(document, componentNodeSelection), componentNodeSelection);
  assert.equal(
    reconcileDocumentSelection(document, selectComponentNode(repeater.id, "unknown-node", "item-2")),
    undefined,
  );
  assert.equal(
    reconcileDocumentSelection(document, selectComponentNode(repeater.id, "component-text")),
    undefined,
  );
  assert.equal(repeaterItemLabel(document, repeater, repeater.items[0], 0), "항목 1 · 한국대학교");
  assert.equal(repeaterItemLabel(document, repeater, repeater.items[1], 1), "항목 2 · 기본 학교");

  const withoutSecondItem = {
    ...document,
    nodes: {
      ...document.nodes,
      [repeater.id]: { ...repeater, items: repeater.items.slice(0, 1) },
    },
  };
  assert.equal(reconcileDocumentSelection(withoutSecondItem, selection), undefined);
  assert.equal(reconcileDocumentSelection(withoutSecondItem, componentNodeSelection), undefined);
});

test("preview zoom은 8%씩 이동하고 50~115% 범위를 넘지 않는다", () => {
  assert.equal(stepPreviewZoom(DEFAULT_PREVIEW_ZOOM, -1), 0.7);
  assert.equal(stepPreviewZoom(DEFAULT_PREVIEW_ZOOM, 1), 0.86);
  assert.equal(stepPreviewZoom(MIN_PREVIEW_ZOOM, -1), MIN_PREVIEW_ZOOM);
  assert.equal(stepPreviewZoom(MAX_PREVIEW_ZOOM, 1), MAX_PREVIEW_ZOOM);
  assert.equal(stepPreviewZoom(1.1, 1), MAX_PREVIEW_ZOOM);
});

test("component Auto Layout drag는 포인터 위치를 형제 삽입 위치로 변환한다", () => {
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

test("component 자유 배치 drag는 CSS pixel 이동량을 pt 좌표로 변환한다", () => {
  assert.equal(pixelsToPoints(96), 72);
  assert.equal(roundLayoutPoint(pixelsToPoints(13)), 9.8);
});
