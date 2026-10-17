import test from "node:test";
import assert from "node:assert/strict";
import { validateDocumentData } from "../src/foundation/documentValidation.ts";
import {
  createDeterministicEntityId,
  migrateDocumentData,
} from "../src/main/document/documentMigration.ts";

test("v3 내부 identity와 모든 참조를 결정적인 v4 identity로 변환한다", () => {
  const source = v3Document();
  const snapshot = structuredClone(source);

  const first = migrateDocumentData(source).document;
  const second = migrateDocumentData(snapshot).document;
  const repeated = migrateDocumentData(first);

  assert.deepEqual(source, snapshot);
  assert.deepEqual(first, second);
  assert.equal(repeated.migrated, false);
  assert.deepEqual(repeated.document, first);
  assert.equal(validateDocumentData(first).valid, true);
  assert.equal(first.schemaVersion, 4);
  assert.equal(first.documentId, source.documentId);
  assert.equal(first.updatedAt, source.updatedAt);
  assert.equal(hasLegacyInternalIds(first), false);

  const id = (kind, sourceId) => createDeterministicEntityId(kind, "document:fixture", sourceId);
  const rootId = id("node", "legacy-node-root");
  const imageId = id("node", "legacy-node-image");
  const instanceId = id("node", "legacy-node-instance");
  const repeaterId = id("node", "legacy-node-repeater");
  const componentRootId = id("node", "legacy-node-component-root");
  const componentImageId = id("node", "legacy-node-component-image");
  const archivedId = id("node", "legacy-node-archived");
  const componentId = id("component", "legacy-component-card");
  const styleId = id("style", "legacy-style-root");
  const assetId = id("asset", "legacy-asset-photo");
  const itemId = id("item", "legacy-node-repeater:legacy-item-one:0");

  assert.equal(first.rootNodeId, rootId);
  assert.deepEqual(first.nodes[rootId].childIds, [imageId, instanceId, repeaterId]);
  assert.equal(first.nodes[rootId].styleId, styleId);
  assert.equal(first.nodes[imageId].assetId, assetId);
  assert.equal(first.nodes[instanceId].componentId, componentId);
  assert.equal(first.nodes[instanceId].props.photo.assetId, assetId);
  assert.equal(first.nodes[repeaterId].itemComponentId, componentId);
  assert.equal(first.nodes[repeaterId].items[0].id, itemId);
  assert.equal(first.nodes[repeaterId].items[0].componentId, componentId);
  assert.equal(first.nodes[repeaterId].items[0].props.photo.assetId, assetId);
  assert.equal(first.nodes[archivedId].archivedFrom.parentId, rootId);
  assert.equal(first.components[componentId].rootNodeId, componentRootId);
  assert.equal(first.components[componentId].propDefinitions[0].id, "photo");
  assert.equal(first.components[componentId].propDefinitions[0].binding.nodeId, componentImageId);
  assert.equal(first.components[componentId].propDefinitions[0].defaultValue.assetId, assetId);
});

test("결정적 ID 후보가 기존 canonical ID와 겹치면 안정적인 다음 후보를 사용한다", () => {
  const source = v3Document();
  const collision = createDeterministicEntityId("node", "document:fixture", "legacy-node-image");
  source.nodes[collision] = {
    id: collision,
    type: "text",
    name: "Existing canonical node",
    visible: true,
    value: "keep",
  };
  source.nodes["legacy-node-root"].childIds.push(collision);

  const first = migrateDocumentData(source).document;
  const second = migrateDocumentData(source).document;
  const migratedImage = Object.values(first.nodes).find((node) => node.name === "Photo");

  assert.equal(first.nodes[collision].value, "keep");
  assert.notEqual(migratedImage.id, collision);
  assert.equal(migratedImage.id, createDeterministicEntityId("node", "document:fixture", "legacy-node-image", 1));
  assert.deepEqual(first, second);
});

test("손상된 v3 참조는 결과를 만들지 않고 v4 legacy identity도 거부한다", () => {
  const broken = v3Document();
  broken.nodes["legacy-node-root"].childIds.push("legacy-node-missing");
  assert.throws(() => migrateDocumentData(broken), /child node/);

  const legacyV4 = { ...v3Document(), schemaVersion: 4 };
  const validation = validateDocumentData(legacyV4);
  assert.equal(validation.valid, false);
  assert.equal(validation.issues.some((issue) => issue.code === "identity.legacy"), true);
});

function v3Document() {
  return {
    schemaVersion: 3,
    documentId: "fixture",
    name: "Migration fixture",
    rootNodeId: "legacy-node-root",
    nodes: {
      "legacy-node-root": {
        id: "legacy-node-root",
        type: "container",
        name: "Root",
        visible: true,
        styleId: "legacy-style-root",
        childIds: ["legacy-node-image", "legacy-node-instance", "legacy-node-repeater"],
      },
      "legacy-node-image": {
        id: "legacy-node-image",
        type: "image",
        name: "Photo",
        visible: true,
        assetId: "legacy-asset-photo",
        alt: "photo",
      },
      "legacy-node-instance": {
        id: "legacy-node-instance",
        type: "component-instance",
        name: "Card",
        visible: true,
        componentId: "legacy-component-card",
        props: { photo: { assetId: "legacy-asset-photo", alt: "instance photo" } },
      },
      "legacy-node-repeater": {
        id: "legacy-node-repeater",
        type: "repeater",
        name: "Cards",
        visible: true,
        itemComponentId: "legacy-component-card",
        items: [{
          id: "legacy-item-one",
          componentId: "legacy-component-card",
          visible: false,
          props: { photo: { assetId: "legacy-asset-photo", alt: "item photo" } },
        }],
      },
      "legacy-node-component-root": {
        id: "legacy-node-component-root",
        type: "container",
        name: "Card root",
        visible: true,
        childIds: ["legacy-node-component-image"],
      },
      "legacy-node-component-image": {
        id: "legacy-node-component-image",
        type: "image",
        name: "Card photo",
        visible: true,
        assetId: "legacy-asset-photo",
        alt: "default photo",
      },
      "legacy-node-archived": {
        id: "legacy-node-archived",
        type: "text",
        name: "Archived",
        visible: false,
        archivedFrom: { parentId: "legacy-node-root", index: 1 },
        value: "preserved",
      },
    },
    components: {
      "legacy-component-card": {
        id: "legacy-component-card",
        name: "Card",
        rootNodeId: "legacy-node-component-root",
        propDefinitions: [{
          id: "photo",
          name: "Photo",
          status: "active",
          valueType: "image",
          binding: { nodeId: "legacy-node-component-image", property: "image.value" },
          defaultValue: { assetId: "legacy-asset-photo", alt: "default photo" },
        }],
      },
    },
    styles: {
      "legacy-style-root": {
        id: "legacy-style-root",
        name: "Root",
        layout: { direction: "column", gapPt: 8 },
      },
    },
    assets: {
      "legacy-asset-photo": {
        id: "legacy-asset-photo",
        type: "image",
        name: "Photo",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,AA==",
      },
    },
    updatedAt: "2026-10-17T00:00:00.000Z",
  };
}

function hasLegacyInternalIds(document) {
  return [
    ...Object.keys(document.nodes),
    ...Object.keys(document.components),
    ...Object.keys(document.styles),
    ...Object.keys(document.assets),
    ...Object.values(document.nodes).flatMap((node) => node.type === "repeater" ? node.items.map((item) => item.id) : []),
  ].some((id) => id.startsWith("legacy-"));
}
