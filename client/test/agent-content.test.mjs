import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { DocumentService } from "../src/main/application/documentService.ts";
import { DocumentRepository } from "../src/main/document/documentRepository.ts";
import { ComponentLibraryRepository } from "../src/main/document/componentLibraryRepository.ts";
import { AccessPolicy, emptyGrants } from "../src/main/mcp/accessPolicy.ts";
import { createAgentProtocol } from "../src/main/mcp/tools.ts";
import { agentDocument } from "./fixtures/agent-document.mjs";
import { applyDocumentOperations } from "../src/main/application/documentOperationAdapter.ts";
import { createEmptyDocument, addNode } from "../src/foundation/document.ts";

async function setup(t) {
  const workspace = await mkdtemp(join(tmpdir(), "formleaf-agent-content-")); t.after(() => rm(workspace, { recursive: true, force: true }));
  const service = new DocumentService(new DocumentRepository(workspace), new ComponentLibraryRepository(workspace), workspace);
  const created = await service.create(); const document = agentDocument(created.document);
  const saved = await service.save(document.documentId, document, created.revision);
  const policy = new AccessPolicy(workspace); await policy.initialize(); await policy.setEnabled(true);
  const { connection } = await policy.create("writer");
  await policy.setGrants(connection.id, { ...emptyGrants(), documentIds: [document.documentId], write: true });
  const server = createAgentProtocol(policy, service, connection.id, "test"); const client = new Client({ name: "writer", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(a); await client.connect(b); await client.listTools();
  t.after(() => Promise.all([client.close(), server.close()]));
  const call = async (name, input) => (await client.callTool({ name, arguments: input })).structuredContent;
  return { workspace, service, document, revision: saved.revision, policy, connection, call };
}
test("F03: 세 target을 한 batch로 저장·재열기하고 Markdown 원문/기본값을 보존한다", async (t) => {
  const { workspace, document, revision, call, service } = await setup(t);
  const operations = [
    { type: "replace_text", target: { kind: "node", nodeId: "markdown" }, oldText: "표", newText: "한글 표" },
    { type: "replace_text", target: { kind: "component-prop", instanceNodeId: "instance", propId: "prop" }, oldText: "기본", newText: "개별" },
    { type: "set_edit_value", target: { kind: "repeater-item-prop", repeaterNodeId: "repeater", itemId: "item", propId: "prop" }, value: "항목 **새 내용**" },
  ];
  const requestId = randomUUID(); const args = { documentId: document.documentId, expectedRevision: revision, operations, requestId };
  const result = await call("apply_operations", args);
  assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.data.persisted, true); assert.equal(result.data.uiSynced, true);
  const saved = await service.load(document.documentId);
  assert.equal(saved.document.nodes.markdown.source, document.nodes.markdown.source.replace("표", "한글 표"));
  assert.equal(saved.document.nodes.instance.props.prop, "개별 **원문**");
  assert.equal(saved.document.nodes.repeater.items[0].props.prop, "항목 **새 내용**");
  assert.equal(saved.document.components.component.propDefinitions[0].defaultValue, "기본 **원문**");
  assert.deepEqual(await call("apply_operations", args), result);
  const journal = await call("get_operation", { requestId }); assert.equal(journal.data.status, "completed");
  assert.equal((await new DocumentRepository(workspace).load(document.documentId)).nodes.markdown.source, saved.document.nodes.markdown.source);
});
test("F03: 오류 batch·dryRun은 저장하지 않고 권한/revision/requestId를 검증한다", async (t) => {
  const { service, document, revision, call, policy, connection } = await setup(t);
  const first = { type: "set_edit_value", target: { kind: "node", nodeId: "text" }, value: "수정" };
  const invalid = { type: "set_edit_value", target: { kind: "node", nodeId: "definition-markdown" }, value: "금지" };
  const base = { documentId: document.documentId, expectedRevision: revision };
  const journalCount = (await service.journal.list()).length;
  assert.equal((await call("apply_operations", { ...base, requestId: randomUUID(), operations: [first, invalid] })).error.code, "INVALID_TARGET");
  assert.equal((await service.load(document.documentId)).revision, revision);
  const dry = await call("apply_operations", { ...base, dryRun: true, operations: [first] });
  assert.equal(dry.data.persisted, false); assert.equal("results" in dry.data, false);
  assert.equal((await service.journal.list()).length, journalCount);
  const requestId = randomUUID();
  const result = await call("apply_operations", { ...base, requestId, operations: [first] });
  assert.equal(result.ok, true);
  assert.equal((await call("apply_operations", { ...base, requestId, operations: [{ ...first, value: "다른 입력" }] })).error.code, "REQUEST_ID_REUSED");
  assert.equal((await call("apply_operations", { ...base, requestId: randomUUID(), operations: [first] })).error.code, "REVISION_CONFLICT");
  await policy.setGrants(connection.id, { ...emptyGrants(), documentIds: [document.documentId] });
  assert.equal((await call("apply_operations", { ...base, requestId, operations: [first] })).error.code, "CAPABILITY_DENIED");
  await policy.setGrants(connection.id, emptyGrants());
  assert.equal((await call("get_operation", { requestId })).error.code, "NOT_FOUND_OR_DENIED");
});
test("F03: 겹치는 일치를 포함한 고유 치환과 rich-text 전체 교체", () => {
  let document = createEmptyDocument();
  document = addNode(document, document.rootNodeId, { id: "text", type: "text", name: "text", visible: true, value: "aaa" });
  document = addNode(document, document.rootNodeId, { id: "rich", type: "rich-text", name: "rich", visible: true, value: { runs: [{ text: "보존" }] } });
  const target = { kind: "node", nodeId: "text" };
  for (const [oldText, code] of [["aa", "AMBIGUOUS_TEXT"], ["bbb", "TEXT_NOT_FOUND"]]) {
    assert.throws(() => applyDocumentOperations(document, [{ type: "replace_text", target, oldText, newText: "b" }]), (error) => error.detail.code === code);
  }
  assert.throws(() => applyDocumentOperations(document, [{ type: "set_edit_value", target, value: { runs: [] } }]), (error) => error.detail.code === "VALIDATION_FAILED");
  const richTarget = { kind: "node", nodeId: "rich" };
  assert.throws(() => applyDocumentOperations(document, [{ type: "replace_text", target: richTarget, oldText: "보존", newText: "x" }]), (error) => error.detail.code === "UNSUPPORTED_OPERATION");
  const value = { runs: [{ text: "강조", marks: [{ type: "bold" }] }] };
  const next = applyDocumentOperations(document, [{ type: "set_edit_value", target: richTarget, value }]);
  assert.deepEqual(next.document.nodes.rich.value, value); assert.deepEqual(document.nodes.rich.value, { runs: [{ text: "보존" }] });
});
