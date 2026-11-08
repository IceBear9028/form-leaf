import * as Check from "./fixtures/assertions.ts";
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
    createId: (prefix: string) => `${prefix}-generated-${sequence += 1}`,
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

function textNode(id: string, value: string) {
  return { id, type: "text" as const, name: id, visible: true, value };
}

await test("선택 subtree를 component로 바꾸면 원래 위치가 instance로 교체되고 출력 값은 유지된다", () => {
  const options = optionsFactory();
  let document = addNode(emptyDocument(), "document-1-root", {
    id: "node-group",
    type: "container" as const,
    name: "Group",
    visible: true,
    childIds: [],
  }, undefined, options);
  document = addNode(document, "node-group", textNode("node-label", "Original"), undefined, options);
  const before = buildRenderTree(document);

  const result = createComponentFromSubtree(document, "node-group", "Reusable block", options);
  const after = buildRenderTree(result.document);

  assert.equal(Check.asNode(result.document.nodes["document-1-root"], 'container').childIds[0], result.instanceNodeId);
  assert.equal(Check.present(result.document.components[result.componentId], 'fixture value').rootNodeId, "node-group");
  assert.equal(Check.present(Check.field(after, 'children').children[0], 'fixture value').type, "component-instance");
  assert.equal(Check.field(Check.present(Check.field(Check.field(Check.present(Check.field(after, 'children').children[0], 'fixture value'), 'child').child, 'children').children[0], 'fixture value'), 'value').value, Check.field(Check.present(Check.field(Check.present(Check.field(before, 'children').children[0], 'fixture value'), 'children').children[0], 'fixture value'), 'value').value);
});

await test("노출한 prop은 instance마다 독립적이고 보관해도 override 값을 보존한다", () => {
  const options = optionsFactory();
  let document = addNode(emptyDocument(), "document-1-root", textNode("node-label", "Default"), undefined, options);
  const converted = createComponentFromSubtree(document, "node-label", "Label block", options);
  document = converted.document;
  const exposed = exposeComponentProp(document, converted.componentId, "node-label", "Label", options);
  document = exposed.document;
  document = addComponentInstance(document, "document-1-root", {
    id: "instance-second",
    type: "component-instance" as const,
    name: "Second",
    visible: true,
    componentId: converted.componentId,
    props: {},
  }, undefined, options);
  document = setComponentInstanceProp(document, converted.instanceNodeId, exposed.propId, "First", options);
  document = setComponentInstanceProp(document, "instance-second", exposed.propId, "Second", options);

  const tree = buildRenderTree(document);
  assert.equal(Check.field(Check.field(Check.present(Check.field(tree, 'children').children[0], 'fixture value'), 'child').child, 'value').value, "First");
  assert.equal(Check.field(Check.field(Check.present(Check.field(tree, 'children').children[1], 'fixture value'), 'child').child, 'value').value, "Second");

  const definition = document.components[converted.componentId];
  document = applyComponentDefinitionDraft(document, { ...Check.present(definition, 'fixture spread'), name: "Renamed block" }, options);
  document = archiveComponentProp(document, converted.componentId, exposed.propId, options);
  assert.equal(Check.present(document.components[converted.componentId], 'fixture value').name, "Renamed block");
  assert.equal(Check.asNode(document.nodes[converted.instanceNodeId], 'component-instance').props[exposed.propId], "First");
  assert.equal(Check.asNode(document.nodes["instance-second"], 'component-instance').props[exposed.propId], "Second");
});

await test("component draft 저장은 원본 구조와 style만 반영하고 연결된 instance 값은 보존한다", () => {
  const options = optionsFactory();
  let document = emptyDocument();
  const sharedStyleId = Check.present(Check.present(document.nodes[document.rootNodeId], 'fixture node').styleId, 'fixture binding');
  const sharedFontWeight = Check.present(document.styles[sharedStyleId], 'fixture value').typography?.fontWeight;
  document = addComponentDefinition(document, {
    id: "component-label",
    name: "Label",
    rootNodeId: "component-label-root",
    propDefinitions: [{
      id: "prop-label",
      name: "Label",
      status: "active" as const,
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
    type: "component-instance" as const,
    name: "First",
    visible: true,
    componentId: "component-label",
    props: { "prop-label": "First value" },
  }, undefined, options);
  document = addComponentInstance(document, document.rootNodeId, {
    id: "instance-second",
    type: "component-instance" as const,
    name: "Second",
    visible: true,
    componentId: "component-label",
    props: { "prop-label": "Second value" },
  }, undefined, options);
  document = addNode(document, document.rootNodeId, {
    id: "repeater-labels",
    type: "repeater" as const,
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
  const localizedStyleId = Check.present(Check.present(draft.nodes["component-label-root"], 'fixture node').styleId, 'fixture binding');
  assert.notEqual(localizedStyleId, sharedStyleId);
  draft = updateNodeStyle(draft, "component-label-root", (style) => ({
    ...style,
    typography: { ...Check.present(style.typography, 'fixture spread'), fontWeight: 700 },
  }), options);
  Check.present(draft.components["component-label"], 'fixture value').name = "Changed label";

  assert.equal(Check.present(document.components["component-label"], 'fixture value').name, "Label");
  assert.equal(Check.present(document.styles[sharedStyleId], 'fixture value').typography?.fontWeight, sharedFontWeight);

  const concurrent = structuredClone(document);
  Check.present(concurrent.nodes[concurrent.rootNodeId], 'fixture node').name = "Preserved outside change";
  const saved = applyComponentDocumentDraft(concurrent, "component-label", draft, options);
  const tree = buildRenderTree(saved);

  assert.equal(Check.present(saved.nodes[saved.rootNodeId], 'fixture node').name, "Preserved outside change");
  assert.equal(Check.present(saved.styles[sharedStyleId], 'fixture value').typography?.fontWeight, sharedFontWeight);
  assert.equal(Check.present(Check.present(saved.styles[localizedStyleId], 'fixture value').typography, 'fixture object').fontWeight, 700);
  assert.equal(Check.present(saved.components["component-label"], 'fixture value').name, "Changed label");
  assert.equal(Check.asNode(saved.nodes["instance-first"], 'component-instance').props["prop-label"], "First value");
  assert.equal(Check.asNode(saved.nodes["instance-second"], 'component-instance').props["prop-label"], "Second value");
  assert.equal(Check.present(Check.asNode(saved.nodes["repeater-labels"], 'repeater').items[0], 'fixture value').props["prop-label"], "Third value");
  assert.equal(Check.field(Check.field(Check.present(Check.field(tree, 'children').children[0], 'fixture value'), 'child').child, 'value').value, "First value");
  assert.equal(Check.field(Check.field(Check.present(Check.field(tree, 'children').children[1], 'fixture value'), 'child').child, 'value').value, "Second value");
  assert.equal(Check.field(Check.present(Check.field(Check.present(Check.field(tree, 'children').children[2], 'fixture value'), 'items').items[0], 'fixture value').child, 'value').value, "Third value");
  assert.equal(Check.present(Check.present(Check.field(Check.present(Check.field(tree, 'children').children[0], 'fixture value'), 'child').child.style, 'fixture object').typography, 'fixture value').fontWeight, 700);
  assert.equal(Check.present(Check.present(Check.field(Check.present(Check.field(tree, 'children').children[1], 'fixture value'), 'child').child.style, 'fixture object').typography, 'fixture value').fontWeight, 700);
  assert.equal(Check.present(Check.present(Check.present(Check.field(Check.present(Check.field(tree, 'children').children[2], 'fixture value'), 'items').items[0], 'fixture value').child.style, 'fixture object').typography, 'fixture value').fontWeight, 700);
});

await test("repeater item은 추가·override·복제·이동·숨김·영구 삭제를 독립적으로 처리한다", () => {
  const options = optionsFactory();
  let document = addComponentDefinition(emptyDocument(), {
    id: "component-row",
    name: "Row",
    rootNodeId: "component-row-text",
    propDefinitions: [{
      id: "prop-label",
      name: "Label",
      status: "active" as const,
      valueType: "text",
      binding: { nodeId: "component-row-text", property: "text.value" },
      defaultValue: "Default",
    }],
  }, {
    "component-row-text": textNode("component-row-text", "Default"),
  }, options);
  document = addNode(document, "document-1-root", {
    id: "node-list",
    type: "repeater" as const,
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
  assert.deepEqual(Check.asNode(repeater, 'repeater').items.map((item) => item.id), [second.itemId, first.itemId]);
  assert.equal(Check.present(Check.asNode(repeater, 'repeater').items[0], 'fixture value').props["prop-label"], "Bravo");
  assert.equal(Check.present(Check.asNode(repeater, 'repeater').items[1], 'fixture value').visible, false);

  const beforeRemoval = document;
  document = removeRepeaterItem(document, "node-list", second.itemId, options);
  assert.deepEqual(Check.asNode(document.nodes["node-list"], 'repeater').items.map((item) => item.id), [first.itemId]);
  assert.deepEqual(Check.asNode(beforeRemoval.nodes["node-list"], 'repeater').items.map((item) => item.id), [second.itemId, first.itemId]);
  assert.throws(
    () => removeRepeaterItem(document, "node-list", second.itemId, options),
    /repeater item을 찾을 수 없습니다/,
  );
});

await test("component cycle을 만드는 구조 변경은 원본을 바꾸지 않고 거부한다", () => {
  const options = optionsFactory();
  let document = addComponentDefinition(emptyDocument(), {
    id: "component-a",
    name: "A",
    rootNodeId: "root-a",
    propDefinitions: [],
  }, { "root-a": { id: "root-a", type: "container" as const, name: "A", visible: true, childIds: [] } }, options);
  document = addComponentDefinition(document, {
    id: "component-b",
    name: "B",
    rootNodeId: "root-b",
    propDefinitions: [],
  }, { "root-b": { id: "root-b", type: "container" as const, name: "B", visible: true, childIds: [] } }, options);
  document = addComponentInstance(document, "root-a", {
    id: "instance-b",
    type: "component-instance" as const,
    name: "B",
    visible: true,
    componentId: "component-b",
    props: {},
  }, undefined, options);

  assert.throws(() => addComponentInstance(document, "root-b", {
    id: "instance-a",
    type: "component-instance" as const,
    name: "A",
    visible: true,
    componentId: "component-a",
    props: {},
  }, undefined, options), /순환/);
  assert.equal(document.nodes["instance-a"], undefined);
  assert.deepEqual(Check.asNode(document.nodes["root-b"], 'container').childIds, []);
});

await test("component package import는 dependency의 모든 ID를 새로 만들고 독립 복사한다", () => {
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
        type: "image" as const,
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
      status: "active" as const,
      valueType: "image",
      binding: { nodeId: "leaf-root", property: "image.value" },
      defaultValue: { assetId: "asset-source", alt: "Pixel" },
    }],
  }, {
    "leaf-root": {
      id: "leaf-root",
      type: "image" as const,
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
      type: "component-instance" as const,
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

  Check.present(source.components["component-entry"], 'fixture value').name = "Changed source";
  assert.equal(Check.present(imported.document.components[imported.componentId], 'fixture value').name, "Entry");
});
