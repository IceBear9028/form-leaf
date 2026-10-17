import test from "node:test";
import assert from "node:assert/strict";
import {
  addComponentDefinition,
  addComponentInstance,
  addNode,
  addRepeaterItem,
  archiveComponentProp,
  archiveNode,
  createEmptyDocument,
  duplicateNodeSubtree,
  isDocumentData,
  moveNode,
  restoreNode,
  setNodeVisibility,
  validateDocumentData,
} from "../src/foundation/document.ts";

const fixedTime = "2026-10-09T00:00:00.000Z";
const transactionOptions = { now: () => fixedTime };

function emptyDocument() {
  return createEmptyDocument({
    documentId: "document-1",
    name: "Untitled",
    now: fixedTime,
    createId: () => "node-root",
  });
}

function textNode(id, name = "Text", value = "") {
  return { id, type: "text", name, visible: true, value };
}

function componentNodes(prefix = "block") {
  return {
    [`${prefix}-root`]: {
      id: `${prefix}-root`,
      type: "container",
      name: "Group",
      visible: true,
      childIds: [`${prefix}-text`],
    },
    [`${prefix}-text`]: textNode(`${prefix}-text`, "Label", "Default"),
  };
}

function componentDefinition(id = "component-block", prefix = "block") {
  return {
    id,
    name: "Block",
    rootNodeId: `${prefix}-root`,
    propDefinitions: [{
      id: "prop-label",
      name: "Label",
      status: "active",
      valueType: "text",
      binding: { nodeId: `${prefix}-text`, property: "text.value" },
      defaultValue: "Default",
    }],
  };
}

test("새 범용 문서는 빈 root container만 가진 유효한 schemaVersion 4 문서다", () => {
  const document = emptyDocument();

  assert.equal(document.schemaVersion, 4);
  assert.equal(document.rootNodeId, "node-root");
  assert.deepEqual(document.nodes[document.rootNodeId].childIds, []);
  assert.equal(document.nodes[document.rootNodeId].styleId, "node-root");
  assert.equal(isDocumentData(document), true);
  assert.deepEqual(document.components, {});
  assert.equal(document.styles["node-root"].name, "일반");
  assert.equal(document.styles["node-root"].typography.fontSizePt, 8.5);
  assert.deepEqual(document.assets, {});
});

test("모든 범용 node와 검증된 style·asset을 목적 이름 없이 검증한다", () => {
  let document = emptyDocument();
  document = {
    ...document,
    styles: {
      ...document.styles,
      "style-1": {
        id: "style-1",
        name: "Primary",
        layout: {
          direction: "column",
          gapPt: 8,
          paddingPt: [12, 12, 12, 12],
          align: "stretch",
          justify: "between",
          width: { mode: "fill" },
          heightPt: 24,
          grow: 1,
          position: "absolute",
          topPt: 2,
          leftPt: -4,
        },
        typography: {
          fontFamily: "Inter",
          fontSizePt: 11,
          lineHeight: 1.5,
          fontWeight: 400,
          color: { kind: "hex", value: "#112233" },
        },
        markdown: {
          listItemGapPt: 4,
        },
        decoration: {
          background: { kind: "token", token: "surface.default" },
          borderWidthPt: 1,
          borderEdges: ["top", "bottom"],
          radiusPt: 4,
        },
        pagination: { keepTogether: true },
      },
    },
    assets: {
      "asset-1": {
        id: "asset-1",
        type: "image",
        name: "Image",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,AA==",
      },
    },
  };
  document = addComponentDefinition(
    document,
    componentDefinition(),
    componentNodes(),
    transactionOptions,
  );

  const nodes = [
    { id: "node-text", type: "text", name: "A", visible: true, value: "Alpha", styleId: "style-1" },
    {
      id: "node-rich",
      type: "rich-text",
      name: "B",
      visible: true,
      value: {
        runs: [{
          text: "Bravo",
          marks: [
            { type: "bold" },
            { type: "color", color: { kind: "hex", value: "#AABBCC" } },
          ],
        }],
      },
    },
    { id: "node-markdown", type: "markdown", name: "C", visible: true, source: "## Charlie" },
    { id: "node-image", type: "image", name: "D", visible: true, assetId: "asset-1", alt: "Delta" },
    {
      id: "node-instance",
      type: "component-instance",
      name: "E",
      visible: true,
      componentId: "component-block",
      props: { "prop-label": "Echo" },
    },
    {
      id: "node-repeater",
      type: "repeater",
      name: "F",
      visible: true,
      itemComponentId: "component-block",
      items: [{
        id: "item-1",
        componentId: "component-block",
        visible: true,
        props: { "prop-label": "Foxtrot" },
      }],
    },
  ];
  for (const node of nodes) {
    document = addNode(document, document.rootNodeId, node, undefined, transactionOptions);
  }

  assert.equal(validateDocumentData(document).valid, true);

  const renamed = structuredClone(document);
  renamed.name = "Completely different";
  Object.values(renamed.nodes).forEach((node, index) => {
    node.name = `Layer ${index}`;
  });
  assert.equal(validateDocumentData(renamed).valid, true);
});

test("Markdown 목록 항목 간격은 음수가 아닌 pt 값만 허용한다", () => {
  const document = emptyDocument();
  document.styles["node-root"].markdown = { listItemGapPt: -1 };

  const result = validateDocumentData(document);

  assert.equal(result.valid, false);
  assert.equal(result.issues.some((issue) => issue.path === "$.styles.node-root.markdown.listItemGapPt"), true);
});

test("node transaction은 추가·이동·복제·숨김·보관·복원을 불변 방식으로 처리한다", () => {
  const original = emptyDocument();
  let document = addNode(original, original.rootNodeId, {
    id: "node-group",
    type: "container",
    name: "Group",
    visible: true,
    childIds: [],
  }, undefined, transactionOptions);
  document = addNode(document, document.rootNodeId, textNode("node-a", "A", "One"), undefined, transactionOptions);
  document = moveNode(document, "node-a", "node-group", 0, transactionOptions);
  document = setNodeVisibility(document, "node-a", false, transactionOptions);

  let sequence = 0;
  const duplicated = duplicateNodeSubtree(
    document,
    "node-group",
    document.rootNodeId,
    undefined,
    {
      ...transactionOptions,
      createId: (prefix) => `${prefix}-copy-${sequence += 1}`,
    },
  );
  document = archiveNode(duplicated.document, duplicated.rootNodeId, transactionOptions);

  assert.equal(original.nodes[original.rootNodeId].childIds.length, 0);
  assert.equal(document.nodes[duplicated.rootNodeId].archivedFrom.parentId, document.rootNodeId);
  assert.equal(isDocumentData(document), true);

  document = restoreNode(document, duplicated.rootNodeId, transactionOptions);
  assert.equal(document.nodes[duplicated.rootNodeId].archivedFrom, undefined);
  assert.equal(document.nodes[document.rootNodeId].childIds.includes(duplicated.rootNodeId), true);
  assert.equal(document.nodes["node-a"].visible, false);
  assert.notEqual(duplicated.idMap.get("node-a"), "node-a");
});

test("component prop 보관은 instance 값을 지우지 않고 repeater 항목도 같은 계약으로 검증한다", () => {
  let document = addComponentDefinition(
    emptyDocument(),
    componentDefinition(),
    componentNodes(),
    transactionOptions,
  );
  document = addComponentInstance(document, document.rootNodeId, {
    id: "node-instance",
    type: "component-instance",
    name: "Instance",
    visible: true,
    componentId: "component-block",
    props: { "prop-label": "Override" },
  }, undefined, transactionOptions);
  document = addNode(document, document.rootNodeId, {
    id: "node-repeater",
    type: "repeater",
    name: "Repeater",
    visible: true,
    itemComponentId: "component-block",
    items: [],
  }, undefined, transactionOptions);
  document = addRepeaterItem(document, "node-repeater", {
    id: "item-1",
    componentId: "component-block",
    visible: true,
    props: { "prop-label": "Item" },
  }, undefined, transactionOptions);
  document = archiveComponentProp(document, "component-block", "prop-label", transactionOptions);

  assert.equal(document.components["component-block"].propDefinitions[0].status, "archived");
  assert.equal(document.nodes["node-instance"].props["prop-label"], "Override");
  assert.equal(document.nodes["node-repeater"].items[0].props["prop-label"], "Item");
  assert.equal(isDocumentData(document), true);
});

test("validator는 dangling reference, node cycle과 component cycle을 보고한다", () => {
  const dangling = emptyDocument();
  dangling.nodes[dangling.rootNodeId].childIds.push("missing-node");
  const danglingResult = validateDocumentData(dangling);
  assert.equal(danglingResult.valid, false);
  assert.equal(danglingResult.issues.some((issue) => issue.code === "node.child-missing"), true);

  const nodeCycle = emptyDocument();
  nodeCycle.nodes["node-child"] = {
    id: "node-child",
    type: "container",
    name: "Child",
    visible: true,
    childIds: [nodeCycle.rootNodeId],
  };
  nodeCycle.nodes[nodeCycle.rootNodeId].childIds.push("node-child");
  const nodeCycleResult = validateDocumentData(nodeCycle);
  assert.equal(nodeCycleResult.valid, false);
  assert.equal(nodeCycleResult.issues.some((issue) => issue.code === "node.cycle"), true);

  const componentCycle = emptyDocument();
  componentCycle.nodes = {
    ...componentCycle.nodes,
    "a-root": { id: "a-root", type: "container", name: "A", visible: true, childIds: ["a-instance"] },
    "a-instance": {
      id: "a-instance",
      type: "component-instance",
      name: "A instance",
      visible: true,
      componentId: "component-b",
      props: {},
    },
    "b-root": { id: "b-root", type: "container", name: "B", visible: true, childIds: ["b-instance"] },
    "b-instance": {
      id: "b-instance",
      type: "component-instance",
      name: "B instance",
      visible: true,
      componentId: "component-a",
      props: {},
    },
  };
  componentCycle.components = {
    "component-a": { id: "component-a", name: "A", rootNodeId: "a-root", propDefinitions: [] },
    "component-b": { id: "component-b", name: "B", rootNodeId: "b-root", propDefinitions: [] },
  };
  const componentCycleResult = validateDocumentData(componentCycle);
  assert.equal(componentCycleResult.valid, false);
  assert.equal(componentCycleResult.issues.some((issue) => issue.code === "component.cycle"), true);
});

test("validator는 임의 CSS와 prop binding 타입 불일치를 허용하지 않는다", () => {
  const document = emptyDocument();
  document.kind = "preset";
  document.categories = [];
  document.styles["style-1"] = {
    id: "style-1",
    name: "Unsafe",
    css: "position: fixed",
    typography: { color: { kind: "hex", value: "red" } },
  };
  document.components["component-1"] = {
    id: "component-1",
    name: "Block",
    rootNodeId: "component-root",
    propDefinitions: [{
      id: "prop-1",
      name: "Wrong",
      status: "active",
      valueType: "markdown",
      binding: { nodeId: "component-text", property: "text.value" },
      defaultValue: "Value",
    }],
  };
  document.nodes["component-root"] = {
    id: "component-root",
    type: "container",
    name: "Root",
    visible: true,
    childIds: ["component-text"],
  };
  document.nodes["component-text"] = textNode("component-text");

  const result = validateDocumentData(document);
  assert.equal(result.valid, false);
  assert.equal(result.issues.some((issue) => issue.code === "object.unknown-key" && issue.path === "$.kind"), true);
  assert.equal(result.issues.some((issue) => issue.code === "object.unknown-key" && issue.path === "$.categories"), true);
  assert.equal(result.issues.some((issue) => issue.code === "object.unknown-key" && issue.path === "$.styles.style-1.css"), true);
  assert.equal(result.issues.some((issue) => issue.code === "color.hex"), true);
  assert.equal(result.issues.some((issue) => issue.code === "component.prop.binding-value"), true);
});

test("validator는 같은 node property에 여러 component prop을 연결하지 않는다", () => {
  let document = addComponentDefinition(
    emptyDocument(),
    componentDefinition(),
    componentNodes(),
    transactionOptions,
  );
  document = structuredClone(document);
  document.components["component-block"].propDefinitions.push({
    id: "prop-duplicate",
    name: "Duplicate",
    status: "active",
    valueType: "text",
    binding: { nodeId: "block-text", property: "text.value" },
    defaultValue: "Duplicate",
  });

  const result = validateDocumentData(document);
  assert.equal(result.valid, false);
  assert.equal(result.issues.some((issue) => issue.code === "component.prop.binding-duplicate"), true);
});
