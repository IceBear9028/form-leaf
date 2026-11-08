import * as Check from "./fixtures/assertions.ts";
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
      status: "active" as const,
      valueType: "text",
      binding: { nodeId: "component-label", property: "text.value" },
      defaultValue: "Default",
    }],
  }, {
    "component-root": {
      id: "component-root",
      type: "container" as const,
      name: "Root",
      visible: true,
      childIds: ["component-label", "component-private"],
    },
    "component-label": {
      id: "component-label",
      type: "text" as const,
      name: "Label",
      visible: true,
      value: "Default",
    },
    "component-private": {
      id: "component-private",
      type: "text" as const,
      name: "Private",
      visible: true,
      value: "Definition only",
    },
  }, options);
  document = addComponentInstance(document, "node-root", {
    id: "instance-a",
    type: "component-instance" as const,
    name: "A",
    visible: true,
    componentId: "component-block",
    props: {},
  }, undefined, options);
  document = addNode(document, "node-root", {
    id: "repeater-a",
    type: "repeater" as const,
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

await test("direct edit target은 node 문자열을 type에 맞게 갱신한다", () => {
  let document = addNode(emptyDocument(), "node-root", {
    id: "node-text",
    type: "text" as const,
    name: "Text",
    visible: true,
    value: "Before",
  }, undefined, options);
  const target = { kind: "node" as const, nodeId: "node-text" };

  assert.equal(readDocumentEditValue(document, target), "Before");
  document = updateDocumentEditValue(document, target, "After", options);
  assert.equal(Check.asNode(document.nodes["node-text"], 'text').value, "After");
  assert.throws(
    () => updateDocumentEditValue(document, target, { runs: [{ text: "Wrong" }] }, options),
    /type/,
  );
});

await test("component와 repeater edit target은 각 override만 독립적으로 갱신한다", () => {
  let document = componentFixture();
  const instanceTarget = { kind: "component-prop" as const, instanceNodeId: "instance-a", propId: "prop-label" };
  const itemTarget = {
    kind: "repeater-item-prop" as const,
    repeaterNodeId: "repeater-a",
    itemId: "item-a",
    propId: "prop-label",
  };
  document = updateDocumentEditValue(document, instanceTarget, "Instance", options);
  document = updateDocumentEditValue(document, itemTarget, "Item", options);

  assert.equal(readDocumentEditValue(document, instanceTarget), "Instance");
  assert.equal(readDocumentEditValue(document, itemTarget), "Item");
  assert.equal(Check.present(Check.present(document.components["component-block"], 'fixture value').propDefinitions[0], 'fixture value').defaultValue, "Default");
});

await test("render tree는 노출된 값에만 stable edit target을 만들고 definition 내부 값은 숨긴다", () => {
  const tree = buildRenderTree(componentFixture());
  const instance = Check.field(tree, 'children').children[0];
  const repeater = Check.field(tree, 'children').children[1];

  assert.deepEqual(Check.present(Check.field(Check.field(Check.present(instance, 'fixture value'), 'child').child, 'children').children[0], 'fixture value').editTarget, {
    kind: "component-prop" as const,
    instanceNodeId: "instance-a",
    propId: "prop-label",
  });
  assert.equal(Check.present(Check.field(Check.field(Check.present(instance, 'fixture value'), 'child').child, 'children').children[1], 'fixture value').editTarget, undefined);
  assert.deepEqual(Check.present(Check.field(Check.present(Check.field(Check.present(repeater, 'fixture value'), 'items').items[0], 'fixture value').child, 'children').children[0], 'fixture value').editTarget, {
    kind: "repeater-item-prop" as const,
    repeaterNodeId: "repeater-a",
    itemId: "item-a",
    propId: "prop-label",
  });
});

await test("rich-text 범위 치환과 mark 연산은 선택 밖 run을 보존한다", () => {
  const original = {
    runs: [
      { text: "Alpha ", marks: [{ type: "bold" as const }] },
      { text: "Bravo" },
    ],
  };
  const replaced = replaceRichTextRange(original, { start: 6, end: 11 }, "Beta");
  assert.equal(replaced.value.runs.map((run) => run.text).join(""), "Alpha Beta");
  assert.deepEqual(Check.present(replaced.value.runs[0], 'fixture value').marks, [{ type: "bold" as const }]);

  const italic = toggleRichTextMark(replaced.value, { start: 6, end: 10 }, { type: "italic" as const });
  assert.equal(Check.present(Check.present(italic.runs.find((run) => run.text.includes("Beta")), 'fixture value').marks, 'fixture value').some((mark) => mark.type === "italic"), true);
  const colored = setRichTextMark(italic, { start: 0, end: 5 }, {
    type: "color" as const,
    color: { kind: "hex" as const, value: "#112233" },
  });
  assert.equal(Check.present(Check.present(colored.runs[0], 'fixture value').marks, 'fixture value').some((mark) => mark.type === "color"), true);
  const reset = removeRichTextMark(colored, { start: 0, end: 5 }, "color");
  assert.equal(Check.present(Check.present(reset.runs[0], 'fixture value').marks, 'fixture value').some((mark) => mark.type === "color"), false);
});
