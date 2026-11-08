import * as Check from "./fixtures/assertions.ts";
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

await test("범용 style의 위치와 offset을 CSS 좌표로 변환한다", () => {
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
      status: "active" as const,
      valueType: "text",
      binding: { nodeId: "component-label", property: "text.value" },
      defaultValue: "Default label",
    }],
  }, {
    "component-root": {
      id: "component-root",
      type: "container" as const,
      name: "Block root",
      visible: true,
      childIds: ["component-label"],
    },
    "component-label": {
      id: "component-label",
      type: "text" as const,
      name: "Label",
      visible: true,
      value: "Definition value",
    },
  }, options);
  document = addNode(document, document.rootNodeId, {
    id: "heading",
    type: "text" as const,
    name: "First layer",
    visible: true,
    styleId: "style-heading",
    value: "Heading value",
  }, undefined, options);
  document = addComponentInstance(document, document.rootNodeId, {
    id: "instance-a",
    type: "component-instance" as const,
    name: "Second layer",
    visible: true,
    componentId: "component-block",
    props: { label: "Instance value" },
  }, undefined, options);
  document = addNode(document, document.rootNodeId, {
    id: "repeater",
    type: "repeater" as const,
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
    type: "markdown" as const,
    name: "Hidden layer",
    visible: false,
    source: "Hidden value",
  }, undefined, options);
  return document;
}

await test("render tree는 component와 repeater prop을 stable path에 적용한다", () => {
  const document = createFixture();
  const tree = buildRenderTree(document);

  assert.equal(tree.type, "container");
  assert.equal(tree.children.length, 4);
  const instance = tree.children[1];
  assert.equal(Check.present(instance, 'fixture value').type, "component-instance");
  assert.equal(Check.field(Check.present(instance, 'fixture value'), 'child').child.type, "container");
  assert.equal(Check.present(Check.field(Check.field(Check.present(instance, 'fixture value'), 'child').child, 'children').children[0], 'fixture value').type, "text");
  assert.equal(Check.field(Check.present(Check.field(Check.field(Check.present(instance, 'fixture value'), 'child').child, 'children').children[0], 'fixture value'), 'value').value, "Instance value");
  assert.match(Check.present(Check.field(Check.field(Check.present(instance, 'fixture value'), 'child').child, 'children').children[0], 'fixture value').renderId, /instance:instance-a|node:instance-a/);

  const repeater = tree.children[2];
  assert.equal(Check.present(repeater, 'fixture value').type, "repeater");
  assert.equal(Check.field(Check.present(repeater, 'fixture value'), 'items').items.length, 2);
  assert.equal(Check.field(Check.present(Check.field(Check.present(Check.field(Check.present(repeater, 'fixture value'), 'items').items[0], 'fixture value').child, 'children').children[0], 'fixture value'), 'value').value, "Item value");
  assert.equal(Check.field(Check.present(Check.field(Check.present(Check.field(Check.present(repeater, 'fixture value'), 'items').items[1], 'fixture value').child, 'children').children[0], 'fixture value'), 'value').value, "Default label");
  assert.equal(Check.present(Check.field(Check.present(repeater, 'fixture value'), 'items').items[1], 'fixture value').visible, false);
  assert.notEqual(Check.present(Check.field(Check.present(repeater, 'fixture value'), 'items').items[0], 'fixture value').child.renderId, Check.present(Check.field(Check.present(repeater, 'fixture value'), 'items').items[1], 'fixture value').child.renderId);

  const renderIds = collectRenderIds(tree);
  assert.equal(new Set(renderIds).size, renderIds.length);
});

await test("component 원본은 document tree와 분리해 편집 가능한 root로 렌더한다", () => {
  const document = createFixture();
  const tree = buildRenderTree(document, "component-root");

  assert.equal(tree.type, "container");
  assert.equal(tree.sourceNodeId, "component-root");
  assert.equal(tree.children.length, 1);
  assert.equal(Check.present(tree.children[0], 'fixture value').sourceNodeId, "component-label");
  assert.equal(Check.field(Check.present(tree.children[0], 'fixture value'), 'value').value, "Definition value");
  assert.deepEqual(Check.present(tree.children[0], 'fixture value').editTarget, { kind: "node" as const, nodeId: "component-label" });
});

await test("사용자 이름을 바꿔도 render path와 출력 값은 달라지지 않는다", () => {
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

await test("root child를 pagination unit으로 만들고 keep·break·overflow를 적용한다", () => {
  const tree = buildRenderTree(createFixture());
  const units = collectPaginationUnits(tree);

  assert.deepEqual(units.map((unit) => unit.node.sourceNodeId), ["heading", "instance-a", "repeater"]);
  assert.equal(Check.present(units[0], 'fixture value').keepWithNext, true);
  assert.equal(Check.present(units[2], 'fixture value').keepTogether, true);
  assert.equal(Check.present(units[2], 'fixture value').forcePageBreakBefore, true);

  const heights = new Map([
    [Check.present(units[0], 'fixture value').id, 40],
    [Check.present(units[1], 'fixture value').id, 50],
    [Check.present(units[2], 'fixture value').id, 120],
  ]);
  const pages = paginate(units, heights, 100);
  assert.equal(pages.length, 2);
  assert.deepEqual(Check.present(pages[0], 'fixture value').units.map((unit) => unit.id), [Check.present(units[0], 'fixture value').id, Check.present(units[1], 'fixture value').id]);
  assert.equal(Check.present(pages[1], 'fixture value').overflow, true);

  const nextUnits = units.slice(0, 2);
  const reconciled = reconcileVisiblePages(pages, nextUnits);
  assert.equal(reconciled.length, 1);
  assert.deepEqual(Check.present(reconciled[0], 'fixture value').units.map((unit) => unit.id), nextUnits.map((unit) => unit.id));
});

await test("분할 가능한 중첩 container는 시각 wrapper를 보존한 pagination unit으로 나눈다", () => {
  const tree: import("../src/renderer/src/pages/document-editor/rendering/renderTree.ts").RenderTreeNode = {
    renderId: "node:root",
    sourceNodeId: "root",
    type: "container" as const,
    name: "Root",
    visible: true,
    children: [{
      renderId: "node:section",
      sourceNodeId: "section",
      type: "container" as const,
      name: "Section",
      visible: true,
      style: {
        id: "pagination-fragment", name: "Pagination fragment",
        layout: { paddingPt: [8, 6, 4, 6] },
        decoration: {
          background: { kind: "hex" as const, value: "#F4F4F5" },
          borderWidthPt: 1,
          borderColor: { kind: "hex" as const, value: "#000000" },
          borderEdges: ["top", "right", "bottom", "left"],
          radiusPt: 4,
        },
      },
      children: [
        {
          renderId: "node:first",
          sourceNodeId: "first",
          type: "text" as const,
          name: "First",
          visible: true,
          value: "First",
        },
        {
          renderId: "node:second",
          sourceNodeId: "second",
          type: "text" as const,
          name: "Second",
          visible: true,
          value: "Second",
        },
      ],
    }],
  };

  const units = collectPaginationUnits(tree);

  assert.equal(units.length, 2);
  assert.notEqual(Check.present(units[0], 'fixture value').id, Check.present(units[1], 'fixture value').id);
  assert.equal(Check.present(units[0], 'fixture value').node.sourceNodeId, "section");
  assert.equal(Check.present(Check.field(Check.present(units[0], 'fixture value').node, 'children').children[0], 'fixture value').sourceNodeId, "first");
  assert.equal(Check.present(Check.field(Check.present(units[1], 'fixture value').node, 'children').children[0], 'fixture value').sourceNodeId, "second");
  assert.deepEqual(Check.present(Check.present(Check.present(units[0], 'fixture value').node.style, 'fixture value').layout, 'fixture value').paddingPt, [8, 6, 4, 6]);
  assert.deepEqual(Check.present(Check.present(Check.present(units[1], 'fixture value').node.style, 'fixture value').layout, 'fixture value').paddingPt, [0, 6, 4, 6]);
  assert.equal(Check.present(Check.present(Check.present(units[1], 'fixture value').node.style, 'fixture value').decoration, 'fixture value').borderWidthPt, 1);
  assert.deepEqual(Check.present(Check.present(Check.present(units[1], 'fixture value').node.style, 'fixture value').decoration, 'fixture value').borderEdges, ["right", "bottom", "left"]);
  assert.deepEqual(Check.present(Check.present(Check.present(units[1], 'fixture value').node.style, 'fixture value').decoration, 'fixture value').background, { kind: "hex" as const, value: "#F4F4F5" });
  assert.equal(Check.present(Check.present(Check.present(units[1], 'fixture value').node.style, 'fixture value').decoration, 'fixture value').radiusPt, 4);
});

await test("repeater 내부 Markdown은 원본을 유지하며 블록 단위 pagination unit으로 나눈다", () => {
  const markdown = {
    renderId: "node:body",
    sourceNodeId: "body",
    type: "markdown" as const,
    name: "Body",
    visible: true,
    source: "First paragraph\n\n## Detail\n\nLast paragraph",
  };
  const tree: import("../src/renderer/src/pages/document-editor/rendering/renderTree.ts").RenderTreeNode = {
    renderId: "node:root",
    sourceNodeId: "root",
    type: "container" as const,
    name: "Root",
    visible: true,
    children: [{
      renderId: "node:list",
      sourceNodeId: "list",
      type: "repeater" as const,
      name: "List",
      visible: true,
      componentId: "component-item",
      items: [{
        id: "item-a",
        visible: true,
        child: {
          renderId: "node:list/item:item-a/root",
          sourceNodeId: "item-root",
          type: "container" as const,
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
    const itemRoot = Check.present(unit.node.items[0], 'fixture value').child;
    assert.equal(itemRoot.type, "container");
    const child = itemRoot.children[0];
    assert.equal(Check.present(child, 'fixture value').type, "markdown");
    return child;
  });
  assert.deepEqual(fragments.map((fragment) => Check.present(Check.field(Check.present(fragment, 'fixture value'), 'fragment').fragment, 'fixture value').blockIndexes), [[0], [1], [2]]);
  assert.equal(fragments.every((fragment) => Check.field(Check.present(fragment, 'fixture value'), 'source').source === markdown.source), true);
  assert.deepEqual(fragments.map((fragment) => [Check.present(Check.field(Check.present(fragment, 'fixture value'), 'fragment').fragment, 'fixture value').first, Check.present(Check.field(Check.present(fragment, 'fixture value'), 'fragment').fragment, 'fixture value').last]), [
    [true, false],
    [false, false],
    [false, true],
  ]);
  assert.equal(Check.present(units[1], 'fixture value').keepWithNext, true);
});

await test("component instance와 원자 콘텐츠는 wrapper를 유지하며 서로 다른 unit으로 나뉜다", () => {
  const tree: import("../src/renderer/src/pages/document-editor/rendering/renderTree.ts").RenderTreeNode = {
    renderId: "node:root",
    sourceNodeId: "root",
    type: "container" as const,
    name: "Root",
    visible: true,
    children: [{
      renderId: "node:instance",
      sourceNodeId: "instance",
      type: "component-instance" as const,
      name: "Instance",
      visible: true,
      componentId: "component-a",
      child: {
        renderId: "node:instance/root",
        sourceNodeId: "component-root",
        type: "container" as const,
        name: "Component root",
        visible: true,
        children: [
          { renderId: "node:text", sourceNodeId: "text", type: "text" as const, name: "Text", visible: true, value: "Text" },
          { renderId: "node:image", sourceNodeId: "image", type: "image" as const, name: "Image", visible: true, alt: "Image" },
        ],
      },
    }],
  };

  const units = collectPaginationUnits(tree);
  assert.equal(units.length, 2);
  assert.equal(units.every((unit) => unit.node.type === "component-instance"), true);
  assert.deepEqual(units.map((unit) => Check.present(Check.field(Check.field(unit.node, 'child').child, 'children').children[0], 'fixture value').type), ["text", "image"]);
});

await test("고정 왼쪽 컬럼과 흐름 오른쪽 컬럼은 트리를 유지하며 오른쪽 내용만 분할한다", () => {
  const fixedStyle = {
    id: "meta",
    name: "Meta",
    layout: { width: { mode: "fixed" as const, valuePt: 88 } },
  };
  const contentStyle: import("../src/foundation/documentModel.ts").StyleDefinition = {
    id: "content",
    name: "Content",
    layout: {
      direction: "column",
      paddingPt: [4, 0, 12, 23],
      width: { mode: "fill" as const },
      grow: 1,
    },
    decoration: {
      borderColor: { kind: "hex" as const, value: "#d9d9d9" },
      borderWidthPt: 0.75,
      borderEdges: ["left"],
    },
  };
  const tree: import("../src/renderer/src/pages/document-editor/rendering/renderTree.ts").RenderTreeNode = {
    renderId: "node:root",
    sourceNodeId: "root",
    type: "container" as const,
    name: "Root",
    visible: true,
    children: [{
      renderId: "node:item",
      sourceNodeId: "item",
      type: "container" as const,
      name: "Item",
      visible: true,
      style: {
        id: "row",
        name: "Row",
        layout: { direction: "row", gapPt: 18, width: { mode: "fill" as const } },
      },
      children: [
        {
          renderId: "node:meta",
          sourceNodeId: "meta",
          type: "container" as const,
          name: "Meta",
          visible: true,
          style: fixedStyle,
          children: [{ renderId: "node:date", sourceNodeId: "date", type: "text" as const, name: "Date", visible: true, value: "2026" }],
        },
        {
          renderId: "node:content",
          sourceNodeId: "content",
          type: "container" as const,
          name: "Content",
          visible: true,
          style: contentStyle,
          children: [
            { renderId: "node:title", sourceNodeId: "title", type: "text" as const, name: "Title", visible: true, value: "Title" },
            { renderId: "node:body", sourceNodeId: "body", type: "markdown" as const, name: "Body", visible: true, source: "First\n\nSecond" },
            { renderId: "node:tags", sourceNodeId: "tags", type: "text" as const, name: "Tags", visible: true, value: "Tags" },
          ],
        },
      ],
    }],
  };

  const units = collectPaginationUnits(tree);
  assert.equal(units.length, 4);
  units.forEach((unit, index) => {
    assert.equal(unit.node.type, "container");
    assert.equal(Check.present(Check.present(unit.node.style, 'fixture value').layout, 'fixture value').position, "relative");
    const content = unit.node.children.at(-1);
    assert.equal(Check.present(content, 'fixture value').sourceNodeId, "content");
    assert.equal(Check.field(Check.present(content, 'fixture value'), 'children').children.length, 1);
    assert.deepEqual(Check.present(Check.present(Check.present(content, 'fixture value').style, 'fixture value').decoration, 'fixture value').borderEdges, ["left"]);
    const placeholder = unit.node.children.at(-2);
    assert.equal(Check.present(placeholder, 'fixture value').sourceNodeId, "layout-placeholder:meta");
    assert.equal(Check.field(Check.present(placeholder, 'fixture value'), 'children').children.length, 0);
    if (index === 0) {
      assert.equal(unit.node.children.length, 3);
      assert.equal(Check.present(unit.node.children[0], 'fixture value').sourceNodeId, "meta");
      assert.equal(Check.present(Check.field(Check.present(unit.node.children[0], 'fixture value'), 'children').children[0], 'fixture value').sourceNodeId, "date");
      assert.equal(Check.present(Check.present(Check.present(unit.node.children[0], 'fixture value').style, 'fixture value').layout, 'fixture value').position, "absolute");
      assert.equal(Check.present(unit.node.children[0], 'fixture value').layoutRole, "fixed-overlay");
      assert.equal(Check.present(placeholder, 'fixture value').layoutFragmentIndex, 0);
    } else {
      assert.equal(unit.node.children.length, 2);
    }
  });
  assert.deepEqual(units.map((unit) => Check.present(Check.present(Check.present(Check.field(unit.node, 'children').children.at(-1), 'fixture value').style, 'fixture object').layout, 'fixture value').paddingPt), [
    [4, 0, 0, 23],
    [0, 0, 0, 23],
    [0, 0, 0, 23],
    [0, 0, 12, 23],
  ]);
});

await test("link renderer는 실행 가능한 위험 protocol을 허용하지 않는다", () => {
  assert.equal(safeHref("https://example.com"), "https://example.com");
  assert.equal(safeHref("mailto:user@example.com"), "mailto:user@example.com");
  assert.equal(safeHref("#section"), "#section");
  assert.equal(safeHref("javascript:alert(1)"), undefined);
  assert.equal(safeHref("data:text/html,hello"), undefined);
  assert.equal(safeHref("https://example.com\nscript"), undefined);
});

function collectRenderIds(node: import("../src/renderer/src/pages/document-editor/rendering/renderTree.ts").RenderTreeNode): string[] {
  const ids = [node.renderId];
  if (node.type === "container") node.children.forEach((child) => ids.push(...collectRenderIds(child)));
  if (node.type === "component-instance") ids.push(...collectRenderIds(node.child));
  if (node.type === "repeater") node.items.forEach((item) => ids.push(...collectRenderIds(item.child)));
  return ids;
}

function stripNames(node: import("../src/renderer/src/pages/document-editor/rendering/renderTree.ts").RenderTreeNode): unknown {
  const { name: _name, ...copy } = node;
  if (node.type === "container") return { ...Check.present(copy, 'fixture spread'), children: node.children.map(stripNames) };
  if (node.type === "component-instance") return { ...Check.present(copy, 'fixture spread'), child: stripNames(node.child) };
  if (node.type === "repeater") return { ...Check.present(copy, 'fixture spread'), items: node.items.map(item => ({ ...item, child: stripNames(item.child) })) };
  return copy;
}
