import test from "node:test";
import assert from "node:assert/strict";
import {
  addComponentDefinition,
  addComponentInstance,
  addNode,
  addRepeaterItemFromDefaults,
  applyComponentDocumentDraft,
  applyComponentDefinitionDraft,
  archiveComponentProp,
  createComponentFromSubtree,
  createComponentDocumentDraft,
  createEmptyDocument,
  duplicateRepeaterItem,
  exposeComponentProp,
  exportComponentPackage,
  importComponentPackage,
  moveRepeaterItem,
  removeRepeaterItem,
  setComponentInstanceProp,
  setRepeaterItemProp,
  setRepeaterItemVisibility,
  updateNodeStyle,
} from "../src/foundation/document.ts";
import { buildRenderTree } from "../src/renderer/src/pages/document-editor/rendering/renderTree.ts";

const now = "2026-10-09T00:00:00.000Z";

function optionsFactory() {
  let sequence = 0;
  return {
    now: () => now,
    createId: (prefix) => `${prefix}-generated-${sequence += 1}`,
  };
}

function emptyDocument(id = "document-1") {
  return createEmptyDocument({
    documentId: id,
    name: "Untitled",
    now,
    createId: () => `${id}-root`,
  });
}

function textNode(id, value) {
  return { id, type: "text", name: id, visible: true, value };
}

test("선택 subtree를 component로 바꾸면 원래 위치가 instance로 교체되고 출력 값은 유지된다", () => {
  const options = optionsFactory();
  let document = addNode(emptyDocument(), "document-1-root", {
    id: "node-group",
    type: "container",
    name: "Group",
    visible: true,
    childIds: [],
  }, undefined, options);
  document = addNode(document, "node-group", textNode("node-label", "Original"), undefined, options);
  const before = buildRenderTree(document);

  const result = createComponentFromSubtree(document, "node-group", "Reusable block", options);
  const after = buildRenderTree(result.document);

  assert.equal(result.document.nodes["document-1-root"].childIds[0], result.instanceNodeId);
  assert.equal(result.document.components[result.componentId].rootNodeId, "node-group");
  assert.equal(after.children[0].type, "component-instance");
  assert.equal(after.children[0].child.children[0].value, before.children[0].children[0].value);
});

test("노출한 prop은 instance마다 독립적이고 보관해도 override 값을 보존한다", () => {
  const options = optionsFactory();
  let document = addNode(emptyDocument(), "document-1-root", textNode("node-label", "Default"), undefined, options);
  const converted = createComponentFromSubtree(document, "node-label", "Label block", options);
  document = converted.document;
  const exposed = exposeComponentProp(document, converted.componentId, "node-label", "Label", options);
  document = exposed.document;
  document = addComponentInstance(document, "document-1-root", {
    id: "instance-second",
    type: "component-instance",
    name: "Second",
    visible: true,
    componentId: converted.componentId,
    props: {},
  }, undefined, options);
  document = setComponentInstanceProp(document, converted.instanceNodeId, exposed.propId, "First", options);
  document = setComponentInstanceProp(document, "instance-second", exposed.propId, "Second", options);

  const tree = buildRenderTree(document);
  assert.equal(tree.children[0].child.value, "First");
  assert.equal(tree.children[1].child.value, "Second");

  const definition = document.components[converted.componentId];
  document = applyComponentDefinitionDraft(document, { ...definition, name: "Renamed block" }, options);
  document = archiveComponentProp(document, converted.componentId, exposed.propId, options);
  assert.equal(document.components[converted.componentId].name, "Renamed block");
  assert.equal(document.nodes[converted.instanceNodeId].props[exposed.propId], "First");
  assert.equal(document.nodes["instance-second"].props[exposed.propId], "Second");
});

test("component draft 저장은 원본 구조와 style만 반영하고 연결된 instance 값은 보존한다", () => {
  const options = optionsFactory();
  let document = emptyDocument();
  const sharedStyleId = document.nodes[document.rootNodeId].styleId;
  const sharedFontWeight = document.styles[sharedStyleId].typography?.fontWeight;
  document = addComponentDefinition(document, {
    id: "component-label",
    name: "Label",
    rootNodeId: "component-label-root",
    propDefinitions: [{
      id: "prop-label",
      name: "Label",
      status: "active",
      valueType: "text",
      binding: { nodeId: "component-label-root", property: "text.value" },
      defaultValue: "Default",
    }],
  }, {
    "component-label-root": {
      ...textNode("component-label-root", "Default"),
      styleId: sharedStyleId,
    },
  }, options);
  document = addComponentInstance(document, document.rootNodeId, {
    id: "instance-first",
    type: "component-instance",
    name: "First",
    visible: true,
    componentId: "component-label",
    props: { "prop-label": "First value" },
  }, undefined, options);
  document = addComponentInstance(document, document.rootNodeId, {
    id: "instance-second",
    type: "component-instance",
    name: "Second",
    visible: true,
    componentId: "component-label",
    props: { "prop-label": "Second value" },
  }, undefined, options);
  document = addNode(document, document.rootNodeId, {
    id: "repeater-labels",
    type: "repeater",
    name: "Labels",
    visible: true,
    itemComponentId: "component-label",
    items: [{
      id: "item-third",
      componentId: "component-label",
      visible: true,
      props: { "prop-label": "Third value" },
    }],
  }, undefined, options);

  let draft = createComponentDocumentDraft(document, "component-label", options);
  const localizedStyleId = draft.nodes["component-label-root"].styleId;
  assert.notEqual(localizedStyleId, sharedStyleId);
  draft = updateNodeStyle(draft, "component-label-root", (style) => ({
    ...style,
    typography: { ...style.typography, fontWeight: 700 },
  }), options);
  draft.components["component-label"].name = "Changed label";

  assert.equal(document.components["component-label"].name, "Label");
  assert.equal(document.styles[sharedStyleId].typography?.fontWeight, sharedFontWeight);

  const concurrent = structuredClone(document);
  concurrent.nodes[concurrent.rootNodeId].name = "Preserved outside change";
  const saved = applyComponentDocumentDraft(concurrent, "component-label", draft, options);
  const tree = buildRenderTree(saved);

  assert.equal(saved.nodes[saved.rootNodeId].name, "Preserved outside change");
  assert.equal(saved.styles[sharedStyleId].typography?.fontWeight, sharedFontWeight);
  assert.equal(saved.styles[localizedStyleId].typography.fontWeight, 700);
  assert.equal(saved.components["component-label"].name, "Changed label");
  assert.equal(saved.nodes["instance-first"].props["prop-label"], "First value");
  assert.equal(saved.nodes["instance-second"].props["prop-label"], "Second value");
  assert.equal(saved.nodes["repeater-labels"].items[0].props["prop-label"], "Third value");
  assert.equal(tree.children[0].child.value, "First value");
  assert.equal(tree.children[1].child.value, "Second value");
  assert.equal(tree.children[2].items[0].child.value, "Third value");
  assert.equal(tree.children[0].child.style.typography.fontWeight, 700);
  assert.equal(tree.children[1].child.style.typography.fontWeight, 700);
  assert.equal(tree.children[2].items[0].child.style.typography.fontWeight, 700);
});

test("repeater item은 추가·override·복제·이동·숨김·영구 삭제를 독립적으로 처리한다", () => {
  const options = optionsFactory();
  let document = addComponentDefinition(emptyDocument(), {
    id: "component-row",
    name: "Row",
    rootNodeId: "component-row-text",
    propDefinitions: [{
      id: "prop-label",
      name: "Label",
      status: "active",
      valueType: "text",
      binding: { nodeId: "component-row-text", property: "text.value" },
      defaultValue: "Default",
    }],
  }, {
    "component-row-text": textNode("component-row-text", "Default"),
  }, options);
  document = addNode(document, "document-1-root", {
    id: "node-list",
    type: "repeater",
    name: "List",
    visible: true,
    itemComponentId: "component-row",
    items: [],
  }, undefined, options);
  const first = addRepeaterItemFromDefaults(document, "node-list", options);
  document = setRepeaterItemProp(first.document, "node-list", first.itemId, "prop-label", "Alpha", options);
  const second = duplicateRepeaterItem(document, "node-list", first.itemId, options);
  document = setRepeaterItemProp(second.document, "node-list", second.itemId, "prop-label", "Bravo", options);
  document = moveRepeaterItem(document, "node-list", second.itemId, 0, options);
  document = setRepeaterItemVisibility(document, "node-list", first.itemId, false, options);

  const repeater = document.nodes["node-list"];
  assert.deepEqual(repeater.items.map((item) => item.id), [second.itemId, first.itemId]);
  assert.equal(repeater.items[0].props["prop-label"], "Bravo");
  assert.equal(repeater.items[1].visible, false);

  const beforeRemoval = document;
  document = removeRepeaterItem(document, "node-list", second.itemId, options);
  assert.deepEqual(document.nodes["node-list"].items.map((item) => item.id), [first.itemId]);
  assert.deepEqual(beforeRemoval.nodes["node-list"].items.map((item) => item.id), [second.itemId, first.itemId]);
  assert.throws(
    () => removeRepeaterItem(document, "node-list", second.itemId, options),
    /repeater item을 찾을 수 없습니다/,
  );
});

test("component cycle을 만드는 구조 변경은 원본을 바꾸지 않고 거부한다", () => {
  const options = optionsFactory();
  let document = addComponentDefinition(emptyDocument(), {
    id: "component-a",
    name: "A",
    rootNodeId: "root-a",
    propDefinitions: [],
  }, { "root-a": { id: "root-a", type: "container", name: "A", visible: true, childIds: [] } }, options);
  document = addComponentDefinition(document, {
    id: "component-b",
    name: "B",
    rootNodeId: "root-b",
    propDefinitions: [],
  }, { "root-b": { id: "root-b", type: "container", name: "B", visible: true, childIds: [] } }, options);
  document = addComponentInstance(document, "root-a", {
    id: "instance-b",
    type: "component-instance",
    name: "B",
    visible: true,
    componentId: "component-b",
    props: {},
  }, undefined, options);

  assert.throws(() => addComponentInstance(document, "root-b", {
    id: "instance-a",
    type: "component-instance",
    name: "A",
    visible: true,
    componentId: "component-a",
    props: {},
  }, undefined, options), /순환/);
  assert.equal(document.nodes["instance-a"], undefined);
  assert.deepEqual(document.nodes["root-b"].childIds, []);
});

test("component package import는 dependency의 모든 ID를 새로 만들고 독립 복사한다", () => {
  const sourceOptions = optionsFactory();
  let source = emptyDocument("source");
  source = {
    ...source,
    styles: {
      ...source.styles,
      "style-source": { id: "style-source", name: "Source", typography: { fontSizePt: 12 } },
    },
    assets: {
      "asset-source": {
        id: "asset-source",
        type: "image",
        name: "Pixel",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,AA==",
      },
    },
  };
  source = addComponentDefinition(source, {
    id: "component-leaf",
    name: "Leaf",
    rootNodeId: "leaf-root",
    propDefinitions: [{
      id: "prop-image",
      name: "Image",
      status: "active",
      valueType: "image",
      binding: { nodeId: "leaf-root", property: "image.value" },
      defaultValue: { assetId: "asset-source", alt: "Pixel" },
    }],
  }, {
    "leaf-root": {
      id: "leaf-root",
      type: "image",
      name: "Image",
      visible: true,
      styleId: "style-source",
      assetId: "asset-source",
      alt: "Pixel",
    },
  }, sourceOptions);
  source = addComponentDefinition(source, {
    id: "component-entry",
    name: "Entry",
    rootNodeId: "entry-root",
    propDefinitions: [],
  }, {
    "entry-root": {
      id: "entry-root",
      type: "component-instance",
      name: "Nested",
      visible: true,
      componentId: "component-leaf",
      props: { "prop-image": { assetId: "asset-source", alt: "Override" } },
    },
  }, sourceOptions);

  const componentPackage = exportComponentPackage(source, "component-entry");
  const target = emptyDocument("target");
  const imported = importComponentPackage(target, componentPackage, optionsFactory());

  assert.equal(Object.keys(imported.document.components).length, 2);
  assert.equal(Object.keys(imported.document.nodes).length, 3);
  assert.equal(Object.keys(imported.document.styles).length, 2);
  assert.equal(Object.keys(imported.document.assets).length, 1);
  assert.notEqual(imported.componentId, "component-entry");
  assert.equal(imported.document.components["component-entry"], undefined);
  assert.equal(imported.document.nodes["entry-root"], undefined);
  assert.equal(imported.document.styles["style-source"], undefined);
  assert.equal(imported.document.assets["asset-source"], undefined);

  source.components["component-entry"].name = "Changed source";
  assert.equal(imported.document.components[imported.componentId].name, "Entry");
});
