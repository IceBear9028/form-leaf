import test from "node:test";
import assert from "node:assert/strict";
import {
  addComponentDefinition,
  addComponentInstance,
  addNode,
  createEmptyDocument,
} from "../src/foundation/document.ts";
import {
  buildRenderTree,
} from "../src/renderer/src/pages/document-editor/rendering/renderTree.ts";
import {
  collectPaginationUnits,
  paginate,
  reconcileVisiblePages,
} from "../src/renderer/src/pages/document-editor/rendering/pagination.ts";
import { safeHref } from "../src/renderer/src/pages/document-editor/rendering/safeHref.ts";

const now = "2026-10-09T00:00:00.000Z";
const options = { now: () => now };

function createFixture() {
  let document = createEmptyDocument({
    documentId: "document-render",
    name: "Render fixture",
    now,
    createId: () => "root",
  });
  document = {
    ...document,
    styles: {
      "style-heading": {
        id: "style-heading",
        name: "Heading",
        pagination: { keepWithNext: true },
      },
      "style-break": {
        id: "style-break",
        name: "Break",
        pagination: { keepTogether: true, forcePageBreakBefore: true },
      },
    },
  };
  document = addComponentDefinition(document, {
    id: "component-block",
    name: "Block",
    rootNodeId: "component-root",
    propDefinitions: [{
      id: "label",
      name: "Label",
      status: "active",
      valueType: "text",
      binding: { nodeId: "component-label", property: "text.value" },
      defaultValue: "Default label",
    }],
  }, {
    "component-root": {
      id: "component-root",
      type: "container",
      name: "Block root",
      visible: true,
      childIds: ["component-label"],
    },
    "component-label": {
      id: "component-label",
      type: "text",
      name: "Label",
      visible: true,
      value: "Definition value",
    },
  }, options);
  document = addNode(document, document.rootNodeId, {
    id: "heading",
    type: "text",
    name: "First layer",
    visible: true,
    styleId: "style-heading",
    value: "Heading value",
  }, undefined, options);
  document = addComponentInstance(document, document.rootNodeId, {
    id: "instance-a",
    type: "component-instance",
    name: "Second layer",
    visible: true,
    componentId: "component-block",
    props: { label: "Instance value" },
  }, undefined, options);
  document = addNode(document, document.rootNodeId, {
    id: "repeater",
    type: "repeater",
    name: "Third layer",
    visible: true,
    styleId: "style-break",
    itemComponentId: "component-block",
    items: [
      {
        id: "item-a",
        componentId: "component-block",
        visible: true,
        props: { label: "Item value" },
      },
      {
        id: "item-b",
        componentId: "component-block",
        visible: false,
        props: {},
      },
    ],
  }, undefined, options);
  document = addNode(document, document.rootNodeId, {
    id: "hidden",
    type: "markdown",
    name: "Hidden layer",
    visible: false,
    source: "Hidden value",
  }, undefined, options);
  return document;
}

test("render tree는 component와 repeater prop을 stable path에 적용한다", () => {
  const document = createFixture();
  const tree = buildRenderTree(document);

  assert.equal(tree.type, "container");
  assert.equal(tree.children.length, 4);
  const instance = tree.children[1];
  assert.equal(instance.type, "component-instance");
  assert.equal(instance.child.type, "container");
  assert.equal(instance.child.children[0].type, "text");
  assert.equal(instance.child.children[0].value, "Instance value");
  assert.match(instance.child.children[0].renderId, /instance:instance-a|node:instance-a/);

  const repeater = tree.children[2];
  assert.equal(repeater.type, "repeater");
  assert.equal(repeater.items.length, 2);
  assert.equal(repeater.items[0].child.children[0].value, "Item value");
  assert.equal(repeater.items[1].child.children[0].value, "Default label");
  assert.equal(repeater.items[1].visible, false);
  assert.notEqual(repeater.items[0].child.renderId, repeater.items[1].child.renderId);

  const renderIds = collectRenderIds(tree);
  assert.equal(new Set(renderIds).size, renderIds.length);
});

test("사용자 이름을 바꿔도 render path와 출력 값은 달라지지 않는다", () => {
  const document = createFixture();
  const first = buildRenderTree(document);
  const renamed = structuredClone(document);
  renamed.name = "Another name";
  Object.values(renamed.nodes).forEach((node, index) => {
    node.name = `Layer ${index}`;
  });
  Object.values(renamed.components).forEach((component, index) => {
    component.name = `Component ${index}`;
  });
  const second = buildRenderTree(renamed);

  assert.deepEqual(stripNames(second), stripNames(first));
});

test("root child를 pagination unit으로 만들고 keep·break·overflow를 적용한다", () => {
  const tree = buildRenderTree(createFixture());
  const units = collectPaginationUnits(tree);

  assert.deepEqual(units.map((unit) => unit.node.sourceNodeId), ["heading", "instance-a", "repeater"]);
  assert.equal(units[0].keepWithNext, true);
  assert.equal(units[2].keepTogether, true);
  assert.equal(units[2].forcePageBreakBefore, true);

  const heights = new Map([
    [units[0].id, 40],
    [units[1].id, 50],
    [units[2].id, 120],
  ]);
  const pages = paginate(units, heights, 100);
  assert.equal(pages.length, 2);
  assert.deepEqual(pages[0].units.map((unit) => unit.id), [units[0].id, units[1].id]);
  assert.equal(pages[1].overflow, true);

  const nextUnits = units.slice(0, 2);
  const reconciled = reconcileVisiblePages(pages, nextUnits);
  assert.equal(reconciled.length, 1);
  assert.deepEqual(reconciled[0].units.map((unit) => unit.id), nextUnits.map((unit) => unit.id));
});

test("link renderer는 실행 가능한 위험 protocol을 허용하지 않는다", () => {
  assert.equal(safeHref("https://example.com"), "https://example.com");
  assert.equal(safeHref("mailto:user@example.com"), "mailto:user@example.com");
  assert.equal(safeHref("#section"), "#section");
  assert.equal(safeHref("javascript:alert(1)"), undefined);
  assert.equal(safeHref("data:text/html,hello"), undefined);
  assert.equal(safeHref("https://example.com\nscript"), undefined);
});

function collectRenderIds(node) {
  const ids = [node.renderId];
  if (node.type === "container") node.children.forEach((child) => ids.push(...collectRenderIds(child)));
  if (node.type === "component-instance") ids.push(...collectRenderIds(node.child));
  if (node.type === "repeater") node.items.forEach((item) => ids.push(...collectRenderIds(item.child)));
  return ids;
}

function stripNames(node) {
  const copy = structuredClone(node);
  const visit = (entry) => {
    delete entry.name;
    if (entry.type === "container") entry.children.forEach(visit);
    if (entry.type === "component-instance") visit(entry.child);
    if (entry.type === "repeater") entry.items.forEach((item) => visit(item.child));
  };
  visit(copy);
  return copy;
}
