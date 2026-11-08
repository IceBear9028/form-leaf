import * as Check from "./fixtures/assertions.ts";
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

function textNode(id: string, name = "Text", value = "") {
  return { id, type: "text" as const, name, visible: true, value };
}

function componentNodes(prefix = "block"): Record<string, import("../src/foundation/documentModel.ts").DocumentNode> {
  return {
    [`${prefix}-root`]: {
      id: `${prefix}-root`,
      type: "container" as const,
      name: "Group",
      visible: true,
      childIds: [`${prefix}-text`],
    },
    [`${prefix}-text`]: textNode(`${prefix}-text`, "Label", "Default"),
  };
}

function componentDefinition(id = "component-block", prefix = "block"): import("../src/foundation/documentModel.ts").ComponentDefinition {
  return {
    id,
    name: "Block",
    rootNodeId: `${prefix}-root`,
    propDefinitions: [{
      id: "prop-label",
      name: "Label",
      status: "active" as const,
      valueType: "text",
      binding: { nodeId: `${prefix}-text`, property: "text.value" },
      defaultValue: "Default",
    }],
  };
}

await test("새 범용 문서는 빈 root container만 가진 유효한 schemaVersion 4 문서다", () => {
  const document = emptyDocument();

  assert.equal(document.schemaVersion, 4);
  assert.equal(document.rootNodeId, "node-root");
  assert.deepEqual(Check.asNode(document.nodes[document.rootNodeId], 'container').childIds, []);
  assert.equal(Check.present(document.nodes[document.rootNodeId], 'fixture node').styleId, "node-root");
  assert.equal(isDocumentData(document), true);
  assert.deepEqual(document.components, {});
  assert.equal(Check.present(document.styles["node-root"], 'fixture value').name, "일반");
  assert.equal(Check.present(Check.present(document.styles["node-root"], 'fixture value').typography, 'fixture value').fontSizePt, 8.5);
  assert.deepEqual(document.assets, {});
});

await test("모든 범용 node와 검증된 style·asset을 목적 이름 없이 검증한다", () => {
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
          width: { mode: "fill" as const },
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
          color: { kind: "hex" as const, value: "#112233" },
        },
        markdown: {
          listItemGapPt: 4,
        },
        decoration: {
          background: { kind: "token" as const, token: "surface.default" },
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
        type: "image" as const,
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
    { id: "node-text", type: "text" as const, name: "A", visible: true, value: "Alpha", styleId: "style-1" },
    {
      id: "node-rich",
      type: "rich-text" as const,
      name: "B",
      visible: true,
      value: {
        runs: [{
          text: "Bravo",
          marks: [
            { type: "bold" as const },
            { type: "color" as const, color: { kind: "hex" as const, value: "#AABBCC" } },
          ],
        }],
      },
    },
    { id: "node-markdown", type: "markdown" as const, name: "C", visible: true, source: "## Charlie" },
    { id: "node-image", type: "image" as const, name: "D", visible: true, assetId: "asset-1", alt: "Delta" },
    {
      id: "node-instance",
      type: "component-instance" as const,
      name: "E",
      visible: true,
      componentId: "component-block",
      props: { "prop-label": "Echo" },
    },
    {
      id: "node-repeater",
      type: "repeater" as const,
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

await test("Markdown 목록 항목 간격은 음수가 아닌 pt 값만 허용한다", () => {
  const document = emptyDocument();
  Check.present(document.styles["node-root"], 'fixture value').markdown = { listItemGapPt: -1 };

  const result = validateDocumentData(document);

  assert.equal(result.valid, false);
  assert.equal(result.issues.some((issue) => issue.path === "$.styles.node-root.markdown.listItemGapPt"), true);
});

await test("node transaction은 추가·이동·복제·숨김·보관·복원을 불변 방식으로 처리한다", () => {
  const original = emptyDocument();
  let document = addNode(original, original.rootNodeId, {
    id: "node-group",
    type: "container" as const,
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

  assert.equal(Check.asNode(original.nodes[original.rootNodeId], 'container').childIds.length, 0);
  assert.equal(Check.present(Check.present(document.nodes[duplicated.rootNodeId], 'fixture node').archivedFrom, 'fixture value').parentId, document.rootNodeId);
  assert.equal(isDocumentData(document), true);

  document = restoreNode(document, duplicated.rootNodeId, transactionOptions);
  assert.equal(Check.present(document.nodes[duplicated.rootNodeId], 'fixture node').archivedFrom, undefined);
  assert.equal(Check.asNode(document.nodes[document.rootNodeId], 'container').childIds.includes(duplicated.rootNodeId), true);
  assert.equal(Check.present(document.nodes["node-a"], 'fixture node').visible, false);
  assert.notEqual(duplicated.idMap.get("node-a"), "node-a");
});

await test("component prop 보관은 instance 값을 지우지 않고 repeater 항목도 같은 계약으로 검증한다", () => {
  let document = addComponentDefinition(
    emptyDocument(),
    componentDefinition(),
    componentNodes(),
    transactionOptions,
  );
  document = addComponentInstance(document, document.rootNodeId, {
    id: "node-instance",
    type: "component-instance" as const,
    name: "Instance",
    visible: true,
    componentId: "component-block",
    props: { "prop-label": "Override" },
  }, undefined, transactionOptions);
  document = addNode(document, document.rootNodeId, {
    id: "node-repeater",
    type: "repeater" as const,
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

  assert.equal(Check.present(Check.present(document.components["component-block"], 'fixture value').propDefinitions[0], 'fixture value').status, "archived");
  assert.equal(Check.asNode(document.nodes["node-instance"], 'component-instance').props["prop-label"], "Override");
  assert.equal(Check.present(Check.asNode(document.nodes["node-repeater"], 'repeater').items[0], 'fixture value').props["prop-label"], "Item");
  assert.equal(isDocumentData(document), true);
});

await test("validator는 dangling reference, node cycle과 component cycle을 보고한다", () => {
  const dangling = emptyDocument();
  Check.asNode(dangling.nodes[dangling.rootNodeId], 'container').childIds.push("missing-node");
  const danglingResult = validateDocumentData(dangling);
  assert.equal(danglingResult.valid, false);
  assert.equal(danglingResult.issues.some((issue) => issue.code === "node.child-missing"), true);

  const nodeCycle = emptyDocument();
  nodeCycle.nodes["node-child"] = {
    id: "node-child",
    type: "container" as const,
    name: "Child",
    visible: true,
    childIds: [nodeCycle.rootNodeId],
  };
  Check.asNode(nodeCycle.nodes[nodeCycle.rootNodeId], 'container').childIds.push("node-child");
  const nodeCycleResult = validateDocumentData(nodeCycle);
  assert.equal(nodeCycleResult.valid, false);
  assert.equal(nodeCycleResult.issues.some((issue) => issue.code === "node.cycle"), true);

  const componentCycle = emptyDocument();
  componentCycle.nodes = {
    ...componentCycle.nodes,
    "a-root": { id: "a-root", type: "container" as const, name: "A", visible: true, childIds: ["a-instance"] },
    "a-instance": {
      id: "a-instance",
      type: "component-instance" as const,
      name: "A instance",
      visible: true,
      componentId: "component-b",
      props: {},
    },
    "b-root": { id: "b-root", type: "container" as const, name: "B", visible: true, childIds: ["b-instance"] },
    "b-instance": {
      id: "b-instance",
      type: "component-instance" as const,
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

await test("validator는 임의 CSS와 prop binding 타입 불일치를 허용하지 않는다", () => {
  const document = emptyDocument();
  // @ts-expect-error -- Deliberately inject a legacy-only field into validator input.
  document.kind = "preset";
  // @ts-expect-error -- Deliberately inject a legacy-only field into validator input.
  document.categories = [];
  document.styles["style-1"] = {
    id: "style-1",
    name: "Unsafe",
    // @ts-expect-error -- Verify that arbitrary CSS is rejected at runtime.
    css: "position: fixed",
    typography: { color: { kind: "hex" as const, value: "red" } },
  };
  document.components["component-1"] = {
    id: "component-1",
    name: "Block",
    rootNodeId: "component-root",
    propDefinitions: [{
      id: "prop-1",
      name: "Wrong",
      status: "active" as const,
      valueType: "markdown",
      binding: { nodeId: "component-text", property: "text.value" },
      defaultValue: "Value",
    }],
  };
  document.nodes["component-root"] = {
    id: "component-root",
    type: "container" as const,
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

await test("validator는 같은 node property에 여러 component prop을 연결하지 않는다", () => {
  let document = addComponentDefinition(
    emptyDocument(),
    componentDefinition(),
    componentNodes(),
    transactionOptions,
  );
  document = structuredClone(document);
  Check.present(document.components["component-block"], 'fixture value').propDefinitions.push({
    id: "prop-duplicate",
    name: "Duplicate",
    status: "active" as const,
    valueType: "text",
    binding: { nodeId: "block-text", property: "text.value" },
    defaultValue: "Duplicate",
  });

  const result = validateDocumentData(document);
  assert.equal(result.valid, false);
  assert.equal(result.issues.some((issue) => issue.code === "component.prop.binding-duplicate"), true);
});
