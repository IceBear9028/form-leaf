import * as Check from "./fixtures/assertions.ts";
import type * as Types from "./fixtures/types.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { validateDocumentData } from "../src/foundation/documentValidation.ts";
import {
  createDeterministicEntityId,
  migrateDocumentData,
} from "../src/main/document/documentMigration.ts";

await test("v3 내부 identity와 모든 참조를 결정적인 v4 identity로 변환한다", () => {
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

  const id = (kind: Parameters<typeof createDeterministicEntityId>[0], sourceId: string) => createDeterministicEntityId(kind, "document:fixture", sourceId);
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
  assert.deepEqual(Check.asNode(first.nodes[rootId], 'container').childIds, [imageId, instanceId, repeaterId]);
  assert.equal(Check.present(first.nodes[rootId], 'fixture node').styleId, styleId);
  assert.equal(Check.field(Check.present(first.nodes[imageId], 'fixture node'), 'assetId').assetId, assetId);
  assert.equal(Check.asNode(first.nodes[instanceId], 'component-instance').componentId, componentId);
  assert.equal(Check.field(Check.present(Check.asNode(first.nodes[instanceId], 'component-instance').props.photo, 'fixture value'), 'assetId').assetId, assetId);
  assert.equal(Check.asNode(first.nodes[repeaterId], 'repeater').itemComponentId, componentId);
  assert.equal(Check.present(Check.asNode(first.nodes[repeaterId], 'repeater').items[0], 'fixture value').id, itemId);
  assert.equal(Check.present(Check.asNode(first.nodes[repeaterId], 'repeater').items[0], 'fixture value').componentId, componentId);
  assert.equal(Check.field(Check.present(Check.present(Check.asNode(first.nodes[repeaterId], 'repeater').items[0], 'fixture value').props.photo, 'fixture value'), 'assetId').assetId, assetId);
  assert.equal(Check.present(Check.present(first.nodes[archivedId], 'fixture node').archivedFrom, 'fixture value').parentId, rootId);
  assert.equal(Check.present(first.components[componentId], 'fixture value').rootNodeId, componentRootId);
  assert.equal(Check.present(Check.present(first.components[componentId], 'fixture value').propDefinitions[0], 'fixture value').id, "photo");
  assert.equal(Check.present(Check.present(first.components[componentId], 'fixture value').propDefinitions[0], 'fixture value').binding.nodeId, componentImageId);
  assert.equal(Check.field(Check.present(Check.present(first.components[componentId], 'fixture value').propDefinitions[0], 'fixture value').defaultValue, 'assetId').assetId, assetId);
});

await test("결정적 ID 후보가 기존 canonical ID와 겹치면 안정적인 다음 후보를 사용한다", () => {
  const source = v3Document();
  const collision = createDeterministicEntityId("node", "document:fixture", "legacy-node-image");
  Object.assign(source.nodes, { [collision]: {
    id: collision,
    type: "text" as const,
    name: "Existing canonical node",
    visible: true,
    value: "keep",
  } });
  source.nodes["legacy-node-root"].childIds.push(collision);

  const first = migrateDocumentData(source).document;
  const second = migrateDocumentData(source).document;
  const migratedImage = Object.values(first.nodes).find((node) => node.name === "Photo");

  assert.equal(Check.asNode(first.nodes[collision], 'text').value, "keep");
  assert.notEqual(Check.present(migratedImage, 'fixture node').id, collision);
  assert.equal(Check.present(migratedImage, 'fixture node').id, createDeterministicEntityId("node", "document:fixture", "legacy-node-image", 1));
  assert.deepEqual(first, second);
});

await test("손상된 v3 참조는 결과를 만들지 않고 v4 legacy identity도 거부한다", () => {
  const broken = v3Document();
  broken.nodes["legacy-node-root"].childIds.push("legacy-node-missing");
  assert.throws(() => migrateDocumentData(broken), /child node/);

  const legacyV4 = { ...v3Document(), schemaVersion: 4 as const };
  const validation = validateDocumentData(legacyV4);
  assert.equal(validation.valid, false);
  assert.equal(validation.issues.some((issue) => issue.code === "identity.legacy"), true);
});

function v3Document() {
  return {
    schemaVersion: 3 as const,
    documentId: "fixture",
    name: "Migration fixture",
    rootNodeId: "legacy-node-root",
    nodes: {
      "legacy-node-root": {
        id: "legacy-node-root",
        type: "container" as const,
        name: "Root",
        visible: true,
        styleId: "legacy-style-root",
        childIds: ["legacy-node-image", "legacy-node-instance", "legacy-node-repeater"],
      },
      "legacy-node-image": {
        id: "legacy-node-image",
        type: "image" as const,
        name: "Photo",
        visible: true,
        assetId: "legacy-asset-photo",
        alt: "photo",
      },
      "legacy-node-instance": {
        id: "legacy-node-instance",
        type: "component-instance" as const,
        name: "Card",
        visible: true,
        componentId: "legacy-component-card",
        props: { photo: { assetId: "legacy-asset-photo", alt: "instance photo" } },
      },
      "legacy-node-repeater": {
        id: "legacy-node-repeater",
        type: "repeater" as const,
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
        type: "container" as const,
        name: "Card root",
        visible: true,
        childIds: ["legacy-node-component-image"],
      },
      "legacy-node-component-image": {
        id: "legacy-node-component-image",
        type: "image" as const,
        name: "Card photo",
        visible: true,
        assetId: "legacy-asset-photo",
        alt: "default photo",
      },
      "legacy-node-archived": {
        id: "legacy-node-archived",
        type: "text" as const,
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
          status: "active" as const,
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
        type: "image" as const,
        name: "Photo",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,AA==",
      },
    },
    updatedAt: "2026-10-17T00:00:00.000Z",
  };
}

function hasLegacyInternalIds(document: Types.DocumentData) {
  return [
    ...Object.keys(document.nodes),
    ...Object.keys(document.components),
    ...Object.keys(document.styles),
    ...Object.keys(document.assets),
    ...Object.values(document.nodes).flatMap((node) => node.type === "repeater" ? node.items.map((item) => item.id) : []),
  ].some((id) => id.startsWith("legacy-"));
}
