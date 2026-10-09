import test from "node:test";
import assert from "node:assert/strict";
import {
  addComponentDefinition,
  addComponentInstance,
  addNode,
  createEmptyDocument,
  readDocumentEditValue,
  removeRichTextMark,
  replaceRichTextRange,
  setRichTextMark,
  toggleRichTextMark,
  updateDocumentEditValue,
} from "../src/foundation/document.ts";
import { buildRenderTree } from "../src/renderer/src/pages/document-editor/rendering/renderTree.ts";

const now = "2026-10-10T00:00:00.000Z";
const options = { now: () => now };

function emptyDocument() {
  return createEmptyDocument({
    documentId: "document-edit",
    name: "Untitled",
    now,
    createId: () => "node-root",
  });
}

function componentFixture() {
  let document = addComponentDefinition(emptyDocument(), {
    id: "component-block",
    name: "Block",
    rootNodeId: "component-root",
    propDefinitions: [{
      id: "prop-label",
      name: "Label",
      status: "active",
      valueType: "text",
      binding: { nodeId: "component-label", property: "text.value" },
      defaultValue: "Default",
    }],
  }, {
    "component-root": {
      id: "component-root",
      type: "container",
      name: "Root",
      visible: true,
      childIds: ["component-label", "component-private"],
    },
    "component-label": {
      id: "component-label",
      type: "text",
      name: "Label",
      visible: true,
      value: "Default",
    },
    "component-private": {
      id: "component-private",
      type: "text",
      name: "Private",
      visible: true,
      value: "Definition only",
    },
  }, options);
  document = addComponentInstance(document, "node-root", {
    id: "instance-a",
    type: "component-instance",
    name: "A",
    visible: true,
    componentId: "component-block",
    props: {},
  }, undefined, options);
  document = addNode(document, "node-root", {
    id: "repeater-a",
    type: "repeater",
    name: "Repeater",
    visible: true,
    itemComponentId: "component-block",
    items: [{
      id: "item-a",
      componentId: "component-block",
      visible: true,
      props: {},
    }],
  }, undefined, options);
  return document;
}

test("direct edit target은 node 문자열을 type에 맞게 갱신한다", () => {
  let document = addNode(emptyDocument(), "node-root", {
    id: "node-text",
    type: "text",
    name: "Text",
    visible: true,
    value: "Before",
  }, undefined, options);
  const target = { kind: "node", nodeId: "node-text" };

  assert.equal(readDocumentEditValue(document, target), "Before");
  document = updateDocumentEditValue(document, target, "After", options);
  assert.equal(document.nodes["node-text"].value, "After");
  assert.throws(
    () => updateDocumentEditValue(document, target, { runs: [{ text: "Wrong" }] }, options),
    /type/,
  );
});

test("component와 repeater edit target은 각 override만 독립적으로 갱신한다", () => {
  let document = componentFixture();
  const instanceTarget = { kind: "component-prop", instanceNodeId: "instance-a", propId: "prop-label" };
  const itemTarget = {
    kind: "repeater-item-prop",
    repeaterNodeId: "repeater-a",
    itemId: "item-a",
    propId: "prop-label",
  };
  document = updateDocumentEditValue(document, instanceTarget, "Instance", options);
  document = updateDocumentEditValue(document, itemTarget, "Item", options);

  assert.equal(readDocumentEditValue(document, instanceTarget), "Instance");
  assert.equal(readDocumentEditValue(document, itemTarget), "Item");
  assert.equal(document.components["component-block"].propDefinitions[0].defaultValue, "Default");
});

test("render tree는 노출된 값에만 stable edit target을 만들고 definition 내부 값은 숨긴다", () => {
  const tree = buildRenderTree(componentFixture());
  const instance = tree.children[0];
  const repeater = tree.children[1];

  assert.deepEqual(instance.child.children[0].editTarget, {
    kind: "component-prop",
    instanceNodeId: "instance-a",
    propId: "prop-label",
  });
  assert.equal(instance.child.children[1].editTarget, undefined);
  assert.deepEqual(repeater.items[0].child.children[0].editTarget, {
    kind: "repeater-item-prop",
    repeaterNodeId: "repeater-a",
    itemId: "item-a",
    propId: "prop-label",
  });
});

test("rich-text 범위 치환과 mark 연산은 선택 밖 run을 보존한다", () => {
  const original = {
    runs: [
      { text: "Alpha ", marks: [{ type: "bold" }] },
      { text: "Bravo" },
    ],
  };
  const replaced = replaceRichTextRange(original, { start: 6, end: 11 }, "Beta");
  assert.equal(replaced.value.runs.map((run) => run.text).join(""), "Alpha Beta");
  assert.deepEqual(replaced.value.runs[0].marks, [{ type: "bold" }]);

  const italic = toggleRichTextMark(replaced.value, { start: 6, end: 10 }, { type: "italic" });
  assert.equal(italic.runs.find((run) => run.text.includes("Beta")).marks.some((mark) => mark.type === "italic"), true);
  const colored = setRichTextMark(italic, { start: 0, end: 5 }, {
    type: "color",
    color: { kind: "hex", value: "#112233" },
  });
  assert.equal(colored.runs[0].marks.some((mark) => mark.type === "color"), true);
  const reset = removeRichTextMark(colored, { start: 0, end: 5 }, "color");
  assert.equal(reset.runs[0].marks.some((mark) => mark.type === "color"), false);
});
