import * as Check from "./fixtures/assertions.ts";
import { expectCode } from "./fixtures/assertions.ts";
import type * as Types from "./fixtures/types.ts";
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

const apply = (doc: Types.DocumentData, ...ops: Types.Operation[]) => applyDocumentOperations(doc, ops);
const code = expectCode;
function fixture() {
  let document = createEmptyDocument();
  document = addNode(document, document.rootNodeId, { id: "group", type: "container" as const, name: "그룹", visible: true, childIds: [] });
  document = addNode(document, "group", { id: "text", type: "text" as const, name: "본문", visible: true, value: "원문" });
  return document;
}
await test("F04: 구조 추가·이동·복제·숨김·보관·복원과 새 ID", () => {
  const original = fixture(); const root = original.rootNodeId;
  const added = apply(original, { type: "add_node" as const, parentId: root, node: { type: "markdown" as const, name: "설명", source: "# 제목" } });
  const id = Check.present(Check.present(Check.present(added.results[0], 'fixture value').created, 'fixture value').nodeId, 'fixture binding');
  assert.equal(Check.field(added.document.nodes[id], 'source').source, "# 제목"); assert.equal(Check.present(added.document.nodes[id], 'fixture object').visible, true);
  let document = apply(added.document, { type: "move_node" as const, nodeId: id, parentId: "group", index: 0 }).document;
  assert.deepEqual(Check.asNode(document.nodes.group, 'container').childIds, [id, "text"]);
  const copy = apply(document, { type: "duplicate_node" as const, nodeId: "group", parentId: root });
  assert.ok(Check.present(Check.present(copy.results[0], 'fixture value').idMap, 'fixture value').text); assert.notEqual(Check.present(Check.present(copy.results[0], 'fixture value').created, 'fixture value').nodeId, "group");
  document = apply(copy.document, { type: "set_visibility" as const, nodeId: id, visible: false }, { type: "archive_node" as const, nodeId: "group" }).document;
  assert.equal(Check.present(document.nodes[id], 'fixture object').visible, false); assert.equal(Check.present(Check.present(document.nodes.group, 'fixture node').archivedFrom, 'fixture value').parentId, root);
  assert.deepEqual(apply(document, { type: "archive_node" as const, nodeId: "group" }).document, document);
  const restored = apply(document, { type: "restore_node" as const, nodeId: "group" }).document;
  assert.equal(Check.present(restored.nodes.group, 'fixture node').archivedFrom, undefined); assert.equal(Check.asNode(restored.nodes[root], 'container').childIds[0], "group");
  assert.deepEqual(apply(restored, { type: "restore_node" as const, nodeId: "group" }).document, restored);
  assert.deepEqual(Check.asNode(original.nodes.group, 'container').childIds, ["text"]);
});
await test("F04: root/cycle/보관 parent/범위 밖 index/없는 asset을 거절한다", () => {
  const document = fixture(); const root = document.rootNodeId;
  for (const operation of [
    { type: "move_node" as const, nodeId: root, parentId: "group" }, { type: "duplicate_node" as const, nodeId: root, parentId: root },
    { type: "archive_node" as const, nodeId: root }, { type: "set_visibility" as const, nodeId: root, visible: false },
  ]) assert.throws(() => apply(document, operation), code("INVALID_TARGET"));
  assert.throws(() => apply(document, { type: "move_node" as const, nodeId: "group", parentId: "group" }), code("VALIDATION_FAILED"));
  assert.throws(() => apply(document, { type: "move_node" as const, nodeId: "text", parentId: "group", index: 1 }), code("VALIDATION_FAILED"));
  assert.throws(() => apply(document, { type: "add_node" as const, parentId: root, node: { type: "text" as const, name: "x", value: "x" }, index: 99 }), code("VALIDATION_FAILED"));
  assert.throws(() => apply(document, { type: "add_node" as const, parentId: root, node: { type: "image" as const, name: "x", assetId: "missing", alt: "" } }), code("INVALID_TARGET"));
  const archived = apply(document, { type: "archive_node" as const, nodeId: "text" }, { type: "archive_node" as const, nodeId: "group" }).document;
  assert.throws(() => apply(archived, { type: "restore_node" as const, nodeId: "text" }), code("INVALID_TARGET"));
  assert.throws(() => apply(archived, { type: "move_node" as const, nodeId: "text", parentId: root }), code("INVALID_TARGET"));
});
await test("F04: MCP 생성은 grant/index/journal과 한 번만 완료되며 새 ID로 구성한다", async (t) => {
  const workspace = await mkdtemp(join(tmpdir(), "formleaf-agent-structure-")); t.after(() => rm(workspace, { recursive: true, force: true }));
  const policy = new AccessPolicy(workspace); await policy.initialize(); await policy.setEnabled(true);
  const service = new DocumentService(new DocumentRepository(workspace), new ComponentLibraryRepository(workspace), workspace);
  service.setCreatedGrantHandler((id, documentId) => policy.grantCreated(id, documentId));
  const { connection } = await policy.create("creator");
  const server = createAgentProtocol(policy, service, connection.id, "test"); const client = new Client({ name: "creator", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(a); await client.connect(b); await client.listTools(); t.after(() => Promise.all([server.close(), client.close()]));
  const call = async <T extends Types.ToolName>(name: T, input: Record<string, unknown> = {}) => Check.toolResult(name, (Check.wireResult(await client.callTool({ name, arguments: input }))).structuredContent);
  const requestId = randomUUID();
  assert.equal(Check.failed((await call("create_document", { requestId, name: "새 구성" }))).error.code, "CAPABILITY_DENIED");
  await policy.setGrants(connection.id, { ...emptyGrants(), write: true, create: true });
  const created = await call("create_document", { requestId, name: "새 구성" });
  assert.equal(created.ok, true, JSON.stringify(created));
  assert.deepEqual(await call("create_document", { requestId, name: "새 구성" }), created);
  assert.deepEqual(policy.current(connection.id).documentIds, [Check.field(Check.success(created).data, 'documentId').documentId]);
  assert.equal((await service.list()).length, 1);
  const changed = await call("apply_operations", { requestId: randomUUID(), documentId: Check.field(Check.success(created).data, 'documentId').documentId, expectedRevision: Check.field(Check.success(created).data, 'revision').revision, operations: [{ type: "add_node" as const, parentId: Check.field(Check.success(created).data, 'rootNodeId').rootNodeId, node: { type: "text" as const, name: "제목", value: "완성" } }] });
  assert.equal(changed.ok, true, JSON.stringify(changed));
  assert.equal(Check.asNode((await service.load(Check.field(Check.success(created).data, 'documentId').documentId)).document.nodes[Check.present(Check.present(Check.present(Check.field(Check.success(changed).data, 'results').results[0], 'fixture object').created, 'fixture value').nodeId, 'fixture key')], 'text').value, "완성");
});
