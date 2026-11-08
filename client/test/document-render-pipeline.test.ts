import * as Check from "./fixtures/assertions.ts";
import test from "node:test";
import assert from "node:assert/strict";
import {
  addNode,
  createEmptyDocument,
} from "../src/foundation/document.ts";
import { inferDocumentUpdateOperations } from "../src/foundation/documentUpdates.ts";
import { createSaveStateStore } from "../src/renderer/src/pages/document-editor/useGenericDocumentSession.ts";
import {
  collectPaginationUnits,
  reusePaginationUnits,
  samePaginatedPages,
} from "../src/renderer/src/pages/document-editor/rendering/pagination.ts";
import {
  buildRenderTree,
  reuseRenderTree,
} from "../src/renderer/src/pages/document-editor/rendering/renderTree.ts";
import {
  buildRenderDependencyIndex,
  createRenderWorkPlan,
  resolveRenderScope,
} from "../src/renderer/src/pages/document-editor/rendering/update/renderPipeline.ts";

const now = "2026-10-15T00:00:00.000Z";

function createFixture() {
  let document = createEmptyDocument({
    documentId: "render-pipeline",
    name: "Render pipeline",
    now,
    createId: () => "root",
  });
  document = {
    ...document,
    styles: {
      ...document.styles,
      text: {
        id: "text",
        name: "Text",
        typography: { fontSizePt: 10, color: { kind: "hex" as const, value: "#111111" } },
      },
    },
  };
  document = addNode(document, document.rootNodeId, {
    id: "first",
    type: "text" as const,
    name: "First",
    visible: true,
    styleId: "text",
    value: "alpha",
  }, undefined, { now: () => now });
  document = addNode(document, document.rootNodeId, {
    id: "second",
    type: "text" as const,
    name: "Second",
    visible: true,
    styleId: "text",
    value: "beta",
  }, undefined, { now: () => now });
  return document;
}

await test("structural sharing 변경 어댑터는 내용·시각 style·순서 변경을 구분한다", () => {
  const document = createFixture();
  const contentChanged = {
    ...document,
    nodes: {
      ...document.nodes,
      first: { ...Check.asNode(document.nodes.first, 'text'), value: "alpha changed" },
    },
  };
  assert.deepEqual(inferDocumentUpdateOperations(document, contentChanged), [
    { type: "node-content-updated" as const, nodeId: "first" },
  ]);

  const colorChanged = {
    ...document,
    styles: {
      ...document.styles,
      text: {
        ...Check.present(document.styles.text, 'fixture spread'),
        typography: {
          ...Check.present(Check.present(document.styles.text, 'fixture value').typography, 'fixture spread'),
          color: { kind: "hex" as const, value: "#3366ff" },
        },
      },
    },
  };
  assert.deepEqual(inferDocumentUpdateOperations(document, colorChanged), [
    { type: "node-style-updated" as const, nodeId: "first", styleKeys: ["typography.color"] },
    { type: "node-style-updated" as const, nodeId: "second", styleKeys: ["typography.color"] },
  ]);

  const reordered = {
    ...document,
    nodes: {
      ...document.nodes,
      root: { ...Check.asNode(document.nodes.root, 'container'), childIds: ["second", "first"] },
    },
  };
  assert.deepEqual(inferDocumentUpdateOperations(document, reordered), [
    { type: "node-moved" as const, nodeId: "second", previousParentId: "root", nextParentId: "root" },
    { type: "node-moved" as const, nodeId: "first", previousParentId: "root", nextParentId: "root" },
  ]);
});

await test("렌더 영향 판정은 색상은 render만, 내용은 해당 unit 측정만 요청한다", () => {
  const document = createFixture();
  const units = collectPaginationUnits(buildRenderTree(document));
  const index = buildRenderDependencyIndex(units);
  const unitOrder = units.map((unit) => unit.id);

  const visual = createRenderWorkPlan(resolveRenderScope({
    revision: 1,
    operations: [{ type: "node-style-updated" as const, nodeId: "first", styleKeys: ["typography.color"] }],
  }, index, unitOrder));
  assert.equal(visual.rebuildWholeTree, false);
  assert.deepEqual([...visual.measureUnitIdsAfterCommit], []);

  const layout = createRenderWorkPlan(resolveRenderScope({
    revision: 2,
    operations: [{ type: "node-content-updated" as const, nodeId: "first" }],
  }, index, unitOrder));
  assert.equal(layout.rebuildWholeTree, false);
  assert.deepEqual([...layout.measureUnitIdsAfterCommit], [Check.present(units[0], 'fixture value').id]);
  assert.equal(layout.repaginateFromUnitId, Check.present(units[0], 'fixture value').id);
});

await test("변경되지 않은 render subtree와 pagination unit은 같은 참조를 유지한다", () => {
  const document = createFixture();
  const previousTree = buildRenderTree(document);
  const nextDocument = {
    ...document,
    nodes: {
      ...document.nodes,
      first: { ...Check.asNode(document.nodes.first, 'text'), value: "changed" },
    },
  };
  const nextTree = reuseRenderTree(previousTree, buildRenderTree(nextDocument));
  assert.equal(previousTree.type, "container");
  assert.equal(nextTree.type, "container");
  assert.notEqual(nextTree.children[0], previousTree.children[0]);
  assert.equal(nextTree.children[1], previousTree.children[1]);

  const previousUnits = collectPaginationUnits(previousTree);
  const nextUnits = reusePaginationUnits(previousUnits, collectPaginationUnits(nextTree));
  assert.notEqual(nextUnits[0], previousUnits[0]);
  assert.equal(nextUnits[1], previousUnits[1]);

  const previousPages = [{ id: "page-1", units: previousUnits, overflow: false }];
  const reusedPages = [{ id: "page-1", units: previousUnits, overflow: false }];
  const changedPages = [{ id: "page-1", units: nextUnits, overflow: false }];
  assert.equal(samePaginatedPages(previousPages, reusedPages), true);
  assert.equal(samePaginatedPages(previousPages, changedPages), false);
});

await test("save lifecycle store는 같은 상태를 중복 publish하지 않는다", () => {
  const store = createSaveStateStore({ type: "saved" as const, at: now });
  let notifications = 0;
  const unsubscribe = store.subscribe(() => notifications += 1);
  store.set({ type: "saved" as const, at: now });
  store.set({ type: "dirty" as const });
  store.set({ type: "dirty" as const });
  store.set({ type: "saving" as const });
  unsubscribe();

  assert.equal(notifications, 2);
  assert.deepEqual(store.getSnapshot(), { type: "saving" as const });
});
