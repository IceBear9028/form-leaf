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
import { styleToCss } from "../src/renderer/src/pages/document-editor/rendering/styleToCss.ts";

const now = "2026-10-09T00:00:00.000Z";
const options = { now: () => now };

test("범용 style의 위치와 offset을 CSS 좌표로 변환한다", () => {
  assert.deepEqual(styleToCss({
    id: "positioned",
    name: "Positioned",
    layout: {
      position: "absolute",
      topPt: 2,
      rightPt: -3,
      bottomPt: 4.5,
      leftPt: 0,
    },
  }), {
    position: "absolute",
    top: "2pt",
    right: "-3pt",
    bottom: "4.5pt",
    left: "0pt",
  });
});

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
      ...document.styles,
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

test("component 원본은 document tree와 분리해 편집 가능한 root로 렌더한다", () => {
  const document = createFixture();
  const tree = buildRenderTree(document, "component-root");

  assert.equal(tree.type, "container");
  assert.equal(tree.sourceNodeId, "component-root");
  assert.equal(tree.children.length, 1);
  assert.equal(tree.children[0].sourceNodeId, "component-label");
  assert.equal(tree.children[0].value, "Definition value");
  assert.deepEqual(tree.children[0].editTarget, { kind: "node", nodeId: "component-label" });
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

test("분할 가능한 중첩 container는 시각 wrapper를 보존한 pagination unit으로 나눈다", () => {
  const tree = {
    renderId: "node:root",
    sourceNodeId: "root",
    type: "container",
    name: "Root",
    visible: true,
    children: [{
      renderId: "node:section",
      sourceNodeId: "section",
      type: "container",
      name: "Section",
      visible: true,
      style: {
        layout: { paddingPt: [8, 6, 4, 6] },
        decoration: {
          background: { kind: "hex", value: "#F4F4F5" },
          borderWidthPt: 1,
          borderColor: { kind: "hex", value: "#000000" },
          borderEdges: ["top", "right", "bottom", "left"],
          radiusPt: 4,
        },
      },
      children: [
        {
          renderId: "node:first",
          sourceNodeId: "first",
          type: "text",
          name: "First",
          visible: true,
          value: "First",
        },
        {
          renderId: "node:second",
          sourceNodeId: "second",
          type: "text",
          name: "Second",
          visible: true,
          value: "Second",
        },
      ],
    }],
  };

  const units = collectPaginationUnits(tree);

  assert.equal(units.length, 2);
  assert.notEqual(units[0].id, units[1].id);
  assert.equal(units[0].node.sourceNodeId, "section");
  assert.equal(units[0].node.children[0].sourceNodeId, "first");
  assert.equal(units[1].node.children[0].sourceNodeId, "second");
  assert.deepEqual(units[0].node.style.layout.paddingPt, [8, 6, 4, 6]);
  assert.deepEqual(units[1].node.style.layout.paddingPt, [0, 6, 4, 6]);
  assert.equal(units[1].node.style.decoration.borderWidthPt, 1);
  assert.deepEqual(units[1].node.style.decoration.borderEdges, ["right", "bottom", "left"]);
  assert.deepEqual(units[1].node.style.decoration.background, { kind: "hex", value: "#F4F4F5" });
  assert.equal(units[1].node.style.decoration.radiusPt, 4);
});

test("repeater 내부 Markdown은 원본을 유지하며 블록 단위 pagination unit으로 나눈다", () => {
  const markdown = {
    renderId: "node:body",
    sourceNodeId: "body",
    type: "markdown",
    name: "Body",
    visible: true,
    source: "First paragraph\n\n## Detail\n\nLast paragraph",
  };
  const tree = {
    renderId: "node:root",
    sourceNodeId: "root",
    type: "container",
    name: "Root",
    visible: true,
    children: [{
      renderId: "node:list",
      sourceNodeId: "list",
      type: "repeater",
      name: "List",
      visible: true,
      componentId: "component-item",
      items: [{
        id: "item-a",
        visible: true,
        child: {
          renderId: "node:list/item:item-a/root",
          sourceNodeId: "item-root",
          type: "container",
          name: "Item",
          visible: true,
          children: [markdown],
        },
      }],
    }],
  };

  const units = collectPaginationUnits(tree);
  assert.equal(units.length, 3);
  const fragments = units.map((unit) => {
    assert.equal(unit.node.type, "repeater");
    const itemRoot = unit.node.items[0].child;
    assert.equal(itemRoot.type, "container");
    const child = itemRoot.children[0];
    assert.equal(child.type, "markdown");
    return child;
  });
  assert.deepEqual(fragments.map((fragment) => fragment.fragment.blockIndexes), [[0], [1], [2]]);
  assert.equal(fragments.every((fragment) => fragment.source === markdown.source), true);
  assert.deepEqual(fragments.map((fragment) => [fragment.fragment.first, fragment.fragment.last]), [
    [true, false],
    [false, false],
    [false, true],
  ]);
  assert.equal(units[1].keepWithNext, true);
});

test("component instance와 원자 콘텐츠는 wrapper를 유지하며 서로 다른 unit으로 나뉜다", () => {
  const tree = {
    renderId: "node:root",
    sourceNodeId: "root",
    type: "container",
    name: "Root",
    visible: true,
    children: [{
      renderId: "node:instance",
      sourceNodeId: "instance",
      type: "component-instance",
      name: "Instance",
      visible: true,
      componentId: "component-a",
      child: {
        renderId: "node:instance/root",
        sourceNodeId: "component-root",
        type: "container",
        name: "Component root",
        visible: true,
        children: [
          { renderId: "node:text", sourceNodeId: "text", type: "text", name: "Text", visible: true, value: "Text" },
          { renderId: "node:image", sourceNodeId: "image", type: "image", name: "Image", visible: true, alt: "Image" },
        ],
      },
    }],
  };

  const units = collectPaginationUnits(tree);
  assert.equal(units.length, 2);
  assert.equal(units.every((unit) => unit.node.type === "component-instance"), true);
  assert.deepEqual(units.map((unit) => unit.node.child.children[0].type), ["text", "image"]);
});

test("고정 왼쪽 컬럼과 흐름 오른쪽 컬럼은 트리를 유지하며 오른쪽 내용만 분할한다", () => {
  const fixedStyle = {
    id: "meta",
    name: "Meta",
    layout: { width: { mode: "fixed", valuePt: 88 } },
  };
  const contentStyle = {
    id: "content",
    name: "Content",
    layout: {
      direction: "column",
      paddingPt: [4, 0, 12, 23],
      width: { mode: "fill" },
      grow: 1,
    },
    decoration: {
      borderColor: { kind: "hex", value: "#d9d9d9" },
      borderWidthPt: 0.75,
      borderEdges: ["left"],
    },
  };
  const tree = {
    renderId: "node:root",
    sourceNodeId: "root",
    type: "container",
    name: "Root",
    visible: true,
    children: [{
      renderId: "node:item",
      sourceNodeId: "item",
      type: "container",
      name: "Item",
      visible: true,
      style: {
        id: "row",
        name: "Row",
        layout: { direction: "row", gapPt: 18, width: { mode: "fill" } },
      },
      children: [
        {
          renderId: "node:meta",
          sourceNodeId: "meta",
          type: "container",
          name: "Meta",
          visible: true,
          style: fixedStyle,
          children: [{ renderId: "node:date", sourceNodeId: "date", type: "text", name: "Date", visible: true, value: "2026" }],
        },
        {
          renderId: "node:content",
          sourceNodeId: "content",
          type: "container",
          name: "Content",
          visible: true,
          style: contentStyle,
          children: [
            { renderId: "node:title", sourceNodeId: "title", type: "text", name: "Title", visible: true, value: "Title" },
            { renderId: "node:body", sourceNodeId: "body", type: "markdown", name: "Body", visible: true, source: "First\n\nSecond" },
            { renderId: "node:tags", sourceNodeId: "tags", type: "text", name: "Tags", visible: true, value: "Tags" },
          ],
        },
      ],
    }],
  };

  const units = collectPaginationUnits(tree);
  assert.equal(units.length, 4);
  units.forEach((unit, index) => {
    assert.equal(unit.node.type, "container");
    assert.equal(unit.node.style.layout.position, "relative");
    const content = unit.node.children.at(-1);
    assert.equal(content.sourceNodeId, "content");
    assert.equal(content.children.length, 1);
    assert.deepEqual(content.style.decoration.borderEdges, ["left"]);
    const placeholder = unit.node.children.at(-2);
    assert.equal(placeholder.sourceNodeId, "layout-placeholder:meta");
    assert.equal(placeholder.children.length, 0);
    if (index === 0) {
      assert.equal(unit.node.children.length, 3);
      assert.equal(unit.node.children[0].sourceNodeId, "meta");
      assert.equal(unit.node.children[0].children[0].sourceNodeId, "date");
      assert.equal(unit.node.children[0].style.layout.position, "absolute");
      assert.equal(unit.node.children[0].layoutRole, "fixed-overlay");
      assert.equal(placeholder.layoutFragmentIndex, 0);
    } else {
      assert.equal(unit.node.children.length, 2);
    }
  });
  assert.deepEqual(units.map((unit) => unit.node.children.at(-1).style.layout.paddingPt), [
    [4, 0, 0, 23],
    [0, 0, 0, 23],
    [0, 0, 0, 23],
    [0, 0, 12, 23],
  ]);
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
