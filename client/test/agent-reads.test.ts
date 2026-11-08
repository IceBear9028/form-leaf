import * as Check from "./fixtures/assertions.ts";
import type * as Types from "./fixtures/types.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { DocumentService } from "../src/main/application/documentService.ts";
import { DocumentRepository } from "../src/main/document/documentRepository.ts";
import { ComponentLibraryRepository } from "../src/main/document/componentLibraryRepository.ts";
import { AccessPolicy, emptyGrants } from "../src/main/mcp/accessPolicy.ts";
import { createAgentProtocol } from "../src/main/mcp/tools.ts";
import { CursorPager } from "../src/main/mcp/cursors.ts";
import { agentDocument } from "./fixtures/agent-document.ts";

async function setup(t: Types.TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "formleaf-agent-reads-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const policy = new AccessPolicy(directory); await policy.initialize(); await policy.setEnabled(true);
  const service = new DocumentService(new DocumentRepository(directory), new ComponentLibraryRepository(directory), directory);
  const created = await service.create();
  const document = agentDocument(created.document);
  await service.save(document.documentId, document, created.revision);
  const secret = await service.create(); await service.rename(secret.document.documentId, "노출 금지 문서");
  const { connection } = await policy.create("reader");
  await policy.setGrants(connection.id, { ...emptyGrants(), documentIds: [document.documentId] });
  const protocol = createAgentProtocol(policy, service, connection.id, "test");
  const client = new Client({ name: "read-client", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair(); await protocol.connect(a); await client.connect(b);
  t.after(() => Promise.all([client.close(), protocol.close()]));
  await client.listTools();
  const call = async <T extends Types.ToolName>(name: T, args: Record<string, unknown> = {}) => Check.toolResult(name, (Check.wireResult(await client.callTool({ name, arguments: args }))).structuredContent);
  return { directory, policy, service, document, secret, connection, client, call };
}

await test("F01/F02: 허용 문서 목록/resource/context만 노출하고 미존재와 비허용을 같은 오류로 처리", async (t) => {
  const { service, document, secret, call, client, policy, connection } = await setup(t);
  assert.deepEqual(Check.success((await call("list_documents"))).data.items.map((item) => item.documentId), [document.documentId]);
  const hidden = await call("get_document", { documentId: secret.document.documentId });
  const missing = await call("get_document", { documentId: "missing" });
  assert.deepEqual(hidden, missing);
  assert.equal(Check.failed(hidden).error.code, "NOT_FOUND_OR_DENIED");
  assert.equal(JSON.stringify(await client.listResources()).includes("노출 금지"), false);
  await assert.rejects(client.readResource({ uri: `formleaf://documents/${secret.document.documentId}` }));
  service.coordinator.update({ documentId: secret.document.documentId, revision: "draft", isEditing: true, hasUnsavedChanges: true, selection: { nodeId: "secret", target: null } });
  assert.equal(Check.success((await call("get_context"))).data.activeDocument, null);
  const outline = await client.readResource({ uri: `formleaf://documents/${document.documentId}` });
  assert.equal(Check.jsonObject(Check.field(Check.present(outline.contents[0], 'fixture value'), 'text').text).documentId, document.documentId);
  await policy.setGrants(connection.id, emptyGrants());
  assert.equal(Check.failed((await call("get_document", { documentId: document.documentId }))).error.code, "NOT_FOUND_OR_DENIED");
  assert.equal((await client.listResources()).resources.length, 1);
});

await test("F02: 세 target·중복 label·default/override·보관과 숨김·Markdown 원문", async (t) => {
  const { document, call } = await setup(t);
  const targets = Check.success((await call("list_edit_targets", { documentId: document.documentId }))).data.items;
  assert.equal(targets.length, 4);
  assert.deepEqual(targets.map((item) => item.target.kind), ["node", "node", "component-prop", "repeater-item-prop"]);
  assert.equal(targets.some((item) => item.target.kind === 'node' && item.target.nodeId === "archived"), false);
  assert.equal(targets.some((item) => item.target.kind === 'node' && item.target.nodeId === "definition-markdown"), false);
  assert.match(Check.present(targets[1], 'fixture value').label, /숨김/);
  assert.equal(Check.present(targets[2], 'fixture value').valueSource, "default"); assert.equal(Check.present(targets[3], 'fixture value').valueSource, "override");
  const markdown = Check.success((await call("get_edit_value", { documentId: document.documentId, target: { kind: "node" as const, nodeId: "markdown" } }))).data;
  assert.equal(markdown.value, Check.asNode(document.nodes.markdown, 'markdown').source);
  assert.equal(Check.present(markdown.markdownCompatibility, 'fixture value').editorSupported, false);
  for (const target of [{ kind: "node" as const, nodeId: "definition-markdown" }, { kind: "node" as const, nodeId: "archived" }, { kind: "component-prop" as const, instanceNodeId: "instance", propId: "old-prop" }]) {
    assert.equal(Check.failed((await call("get_edit_value", { documentId: document.documentId, target }))).error.code, "INVALID_TARGET");
  }
  assert.equal(Check.success((await call("get_edit_value", { documentId: document.documentId, target: Check.present(targets[2], 'fixture value').target }))).data.value, "기본 **원문**");
  assert.equal(Check.success((await call("get_edit_value", { documentId: document.documentId, target: Check.present(targets[3], 'fixture value').target }))).data.value, "항목 원문");
  const canonical = Check.success((await call("get_document", { documentId: document.documentId, view: "canonical" }))).data;
  assert.deepEqual(Check.field(canonical, 'document').document.assets, [{ id: "image", name: "첨부", mimeType: "image/png" }]);
  assert.equal(JSON.stringify(canonical).includes("base64"), false);
  const outline = Check.success((await call("get_document", { documentId: document.documentId }))).data;
  assert.equal(Check.present(Check.field(Check.present(outline, 'fixture value'), 'nodes').nodes.find((node) => node.id === "archived"), 'fixture value').archived, true);
  assert.equal(Check.field(Check.present(outline, 'fixture value'), 'nodes').nodes.some((node) => node.id === "definition"), false);
  const component = Check.success((await call("get_component", { source: "document", documentId: document.documentId, componentId: "component" }))).data;
  assert.equal(Check.present(component.propDefinitions[1], 'fixture value').status, "archived");
  assert.equal(Check.failed((await call("list_components"))).error.code, "CAPABILITY_DENIED");
});

await test("F02: revision 변경 후 target cursor를 거절한다", async (t) => {
  const { service, document, call } = await setup(t);
  const first = Check.success((await call("list_edit_targets", { documentId: document.documentId, limit: 1 }))).data;
  assert.equal(first.items.length, 1); assert.ok(first.nextCursor);
  const next = Check.success((await call("list_edit_targets", { documentId: document.documentId, limit: 1, cursor: first.nextCursor }))).data;
  assert.equal(Check.field(Check.present(next.items[0], 'fixture value').target, 'nodeId').nodeId, "markdown");
  const snapshot = await service.load(document.documentId);
  await service.save(document.documentId, { ...snapshot.document, name: "목록 변경" }, snapshot.revision);
  assert.equal(Check.failed((await call("list_edit_targets", { documentId: document.documentId, limit: 1, cursor: first.nextCursor }))).error.code, "INVALID_CURSOR");
});

await test("F02: 큰 기존 값은 입력 글자 수 제한과 분리하고 JSON 한도 초과만 명시적으로 거절한다", async (t) => {
  const { service, document, call } = await setup(t);
  let snapshot = await service.load(document.documentId);
  const long = "가".repeat(100_001);
  Check.asNode(snapshot.document.nodes.text, 'text').value = long;
  Check.present(Check.present(snapshot.document.components.component, 'fixture value').propDefinitions[0], 'fixture value').defaultValue = long;
  await service.save(document.documentId, snapshot.document, snapshot.revision);
  assert.equal(Check.success((await call("get_edit_value", { documentId: document.documentId, target: { kind: "node" as const, nodeId: "text" } }))).data.value, long);
  assert.equal(Check.present(Check.success((await call("get_component", { source: "document", documentId: document.documentId, componentId: "component" }))).data.propDefinitions[0], 'fixture value').defaultValue, long);
  snapshot = await service.load(document.documentId);
  Check.asNode(snapshot.document.nodes.text, 'text').value = "가".repeat(800_000);
  await service.save(document.documentId, snapshot.document, snapshot.revision);
  const oversized = await call("get_edit_value", { documentId: document.documentId, target: { kind: "node" as const, nodeId: "text" } });
  assert.equal(oversized.ok, false); assert.equal(Check.failed(oversized).error.code, "RESULT_TOO_LARGE");
});

await test("F02: cursor는 credential/query/snapshot/만료에 묶이고 변조를 거절한다", () => {
  let now = 0; const pager = new CursorPager(() => now);
  const items = [{ id: 1 }, { id: 2 }];
  const page = pager.page(items, "credential", { query: "q" }, 1);
  assert.ok(page.nextCursor); const nextCursor = page.nextCursor;
  assert.equal(Check.present(pager.page(items, "credential", { query: "q" }, 1, nextCursor).items[0], 'fixture value').id, 2);
  for (const [data, credential, scope, cursor] of [
    [items, "other", { query: "q" }, nextCursor], [items, "credential", { query: "other" }, nextCursor],
    [[...items, { id: 3 }], "credential", { query: "q" }, nextCursor], [items, "credential", { query: "q" }, nextCursor + "x"],
  ] satisfies Array<[typeof items, string, {query:string}, string]>) assert.throws(() => pager.page(data, credential, scope, 1, cursor), Check.expectCode("INVALID_CURSOR"));
  now = 600001;
  assert.throws(() => pager.page(items, "credential", { query: "q" }, 1, nextCursor), Check.expectCode("INVALID_CURSOR"));
});
