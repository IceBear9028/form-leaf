import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createEmptyDocument, addNode } from "../src/foundation/document.ts";
import { applyDocumentOperations } from "../src/main/application/documentOperationAdapter.ts";
import { DocumentService } from "../src/main/application/documentService.ts";
import { DocumentRepository } from "../src/main/document/documentRepository.ts";
import { ComponentLibraryRepository } from "../src/main/document/componentLibraryRepository.ts";
import { AccessPolicy, emptyGrants } from "../src/main/mcp/accessPolicy.ts";
import { createAgentProtocol } from "../src/main/mcp/tools.ts";

const apply = (doc, ...ops) => applyDocumentOperations(doc, ops);
const code = (code) => (error) => error.detail?.code === code;
function fixture() {
  let document = createEmptyDocument();
  document = addNode(document, document.rootNodeId, { id: "group", type: "container", name: "그룹", visible: true, childIds: [] });
  document = addNode(document, "group", { id: "text", type: "text", name: "본문", visible: true, value: "원문" });
  return document;
}
test("F04: 구조 추가·이동·복제·숨김·보관·복원과 새 ID", () => {
  const original = fixture(); const root = original.rootNodeId;
  const added = apply(original, { type: "add_node", parentId: root, node: { type: "markdown", name: "설명", source: "# 제목" } });
  const id = added.results[0].created.nodeId;
  assert.equal(added.document.nodes[id].source, "# 제목"); assert.equal(added.document.nodes[id].visible, true);
  let document = apply(added.document, { type: "move_node", nodeId: id, parentId: "group", index: 0 }).document;
  assert.deepEqual(document.nodes.group.childIds, [id, "text"]);
  const copy = apply(document, { type: "duplicate_node", nodeId: "group", parentId: root });
  assert.ok(copy.results[0].idMap.text); assert.notEqual(copy.results[0].created.nodeId, "group");
  document = apply(copy.document, { type: "set_visibility", nodeId: id, visible: false }, { type: "archive_node", nodeId: "group" }).document;
  assert.equal(document.nodes[id].visible, false); assert.equal(document.nodes.group.archivedFrom.parentId, root);
  assert.deepEqual(apply(document, { type: "archive_node", nodeId: "group" }).document, document);
  const restored = apply(document, { type: "restore_node", nodeId: "group" }).document;
  assert.equal(restored.nodes.group.archivedFrom, undefined); assert.equal(restored.nodes[root].childIds[0], "group");
  assert.deepEqual(apply(restored, { type: "restore_node", nodeId: "group" }).document, restored);
  assert.deepEqual(original.nodes.group.childIds, ["text"]);
});
test("F04: root/cycle/보관 parent/범위 밖 index/없는 asset을 거절한다", () => {
  const document = fixture(); const root = document.rootNodeId;
  for (const operation of [
    { type: "move_node", nodeId: root, parentId: "group" }, { type: "duplicate_node", nodeId: root, parentId: root },
    { type: "archive_node", nodeId: root }, { type: "set_visibility", nodeId: root, visible: false },
  ]) assert.throws(() => apply(document, operation), code("INVALID_TARGET"));
  assert.throws(() => apply(document, { type: "move_node", nodeId: "group", parentId: "group" }), code("VALIDATION_FAILED"));
  assert.throws(() => apply(document, { type: "move_node", nodeId: "text", parentId: "group", index: 1 }), code("VALIDATION_FAILED"));
  assert.throws(() => apply(document, { type: "add_node", parentId: root, node: { type: "text", name: "x", value: "x" }, index: 99 }), code("VALIDATION_FAILED"));
  assert.throws(() => apply(document, { type: "add_node", parentId: root, node: { type: "image", name: "x", assetId: "missing", alt: "" } }), code("INVALID_TARGET"));
  const archived = apply(document, { type: "archive_node", nodeId: "text" }, { type: "archive_node", nodeId: "group" }).document;
  assert.throws(() => apply(archived, { type: "restore_node", nodeId: "text" }), code("INVALID_TARGET"));
  assert.throws(() => apply(archived, { type: "move_node", nodeId: "text", parentId: root }), code("INVALID_TARGET"));
});
test("F04: MCP 생성은 grant/index/journal과 한 번만 완료되며 새 ID로 구성한다", async (t) => {
  const workspace = await mkdtemp(join(tmpdir(), "formleaf-agent-structure-")); t.after(() => rm(workspace, { recursive: true, force: true }));
  const policy = new AccessPolicy(workspace); await policy.initialize(); await policy.setEnabled(true);
  const service = new DocumentService(new DocumentRepository(workspace), new ComponentLibraryRepository(workspace), workspace);
  service.setCreatedGrantHandler((id, documentId) => policy.grantCreated(id, documentId));
  const { connection } = await policy.create("creator");
  const server = createAgentProtocol(policy, service, connection.id, "test"); const client = new Client({ name: "creator", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(a); await client.connect(b); await client.listTools(); t.after(() => Promise.all([server.close(), client.close()]));
  const call = async (name, input) => (await client.callTool({ name, arguments: input })).structuredContent;
  const requestId = randomUUID();
  assert.equal((await call("create_document", { requestId, name: "새 구성" })).error.code, "CAPABILITY_DENIED");
  await policy.setGrants(connection.id, { ...emptyGrants(), write: true, create: true });
  const created = await call("create_document", { requestId, name: "새 구성" });
  assert.equal(created.ok, true, JSON.stringify(created));
  assert.deepEqual(await call("create_document", { requestId, name: "새 구성" }), created);
  assert.deepEqual(policy.current(connection.id).documentIds, [created.data.documentId]);
  assert.equal((await service.list()).length, 1);
  const changed = await call("apply_operations", { requestId: randomUUID(), documentId: created.data.documentId, expectedRevision: created.data.revision, operations: [{ type: "add_node", parentId: created.data.rootNodeId, node: { type: "text", name: "제목", value: "완성" } }] });
  assert.equal(changed.ok, true, JSON.stringify(changed));
  assert.equal((await service.load(created.data.documentId)).document.nodes[changed.data.results[0].created.nodeId].value, "완성");
});
