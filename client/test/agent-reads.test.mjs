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
import { agentDocument } from "./fixtures/agent-document.mjs";

async function setup(t) {
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
  const call = async (name, args = {}) => (await client.callTool({ name, arguments: args })).structuredContent;
  return { directory, policy, service, document, secret, connection, client, call };
}

test("F01/F02: 허용 문서 목록/resource/context만 노출하고 미존재와 비허용을 같은 오류로 처리", async (t) => {
  const { service, document, secret, call, client, policy, connection } = await setup(t);
  assert.deepEqual((await call("list_documents")).data.items.map((item) => item.documentId), [document.documentId]);
  const hidden = await call("get_document", { documentId: secret.document.documentId });
  const missing = await call("get_document", { documentId: "missing" });
  assert.deepEqual(hidden, missing);
  assert.equal(hidden.error.code, "NOT_FOUND_OR_DENIED");
  assert.equal(JSON.stringify(await client.listResources()).includes("노출 금지"), false);
  await assert.rejects(client.readResource({ uri: `formleaf://documents/${secret.document.documentId}` }));
  service.coordinator.update({ documentId: secret.document.documentId, revision: "draft", isEditing: true, hasUnsavedChanges: true, selection: { nodeId: "secret", target: null } });
  assert.equal((await call("get_context")).data.activeDocument, null);
  const outline = await client.readResource({ uri: `formleaf://documents/${document.documentId}` });
  assert.equal(JSON.parse(outline.contents[0].text).documentId, document.documentId);
  await policy.setGrants(connection.id, emptyGrants());
  assert.equal((await call("get_document", { documentId: document.documentId })).error.code, "NOT_FOUND_OR_DENIED");
  assert.equal((await client.listResources()).resources.length, 1);
});

test("F02: 세 target·중복 label·default/override·보관과 숨김·Markdown 원문", async (t) => {
  const { document, call } = await setup(t);
  const targets = (await call("list_edit_targets", { documentId: document.documentId })).data.items;
  assert.equal(targets.length, 4);
  assert.deepEqual(targets.map((item) => item.target.kind), ["node", "node", "component-prop", "repeater-item-prop"]);
  assert.equal(targets.some((item) => item.target.nodeId === "archived"), false);
  assert.equal(targets.some((item) => item.target.nodeId === "definition-markdown"), false);
  assert.match(targets[1].label, /숨김/);
  assert.equal(targets[2].valueSource, "default"); assert.equal(targets[3].valueSource, "override");
  const markdown = (await call("get_edit_value", { documentId: document.documentId, target: { kind: "node", nodeId: "markdown" } })).data;
  assert.equal(markdown.value, document.nodes.markdown.source);
  assert.equal(markdown.markdownCompatibility.editorSupported, false);
  for (const target of [{ kind: "node", nodeId: "definition-markdown" }, { kind: "node", nodeId: "archived" }, { kind: "component-prop", instanceNodeId: "instance", propId: "old-prop" }]) {
    assert.equal((await call("get_edit_value", { documentId: document.documentId, target })).error.code, "INVALID_TARGET");
  }
  assert.equal((await call("get_edit_value", { documentId: document.documentId, target: targets[2].target })).data.value, "기본 **원문**");
  assert.equal((await call("get_edit_value", { documentId: document.documentId, target: targets[3].target })).data.value, "항목 원문");
  const canonical = (await call("get_document", { documentId: document.documentId, view: "canonical" })).data;
  assert.deepEqual(canonical.document.assets, [{ id: "image", name: "첨부", mimeType: "image/png" }]);
  assert.equal(JSON.stringify(canonical).includes("base64"), false);
  const outline = (await call("get_document", { documentId: document.documentId })).data;
  assert.equal(outline.nodes.find((node) => node.id === "archived").archived, true);
  assert.equal(outline.nodes.some((node) => node.id === "definition"), false);
  const component = (await call("get_component", { source: "document", documentId: document.documentId, componentId: "component" })).data;
  assert.equal(component.propDefinitions[1].status, "archived");
  assert.equal((await call("list_components")).error.code, "CAPABILITY_DENIED");
});

test("F02: revision 변경 후 target cursor를 거절한다", async (t) => {
  const { service, document, call } = await setup(t);
  const first = (await call("list_edit_targets", { documentId: document.documentId, limit: 1 })).data;
  assert.equal(first.items.length, 1); assert.ok(first.nextCursor);
  const next = (await call("list_edit_targets", { documentId: document.documentId, limit: 1, cursor: first.nextCursor })).data;
  assert.equal(next.items[0].target.nodeId, "markdown");
  const snapshot = await service.load(document.documentId);
  await service.save(document.documentId, { ...snapshot.document, name: "목록 변경" }, snapshot.revision);
  assert.equal((await call("list_edit_targets", { documentId: document.documentId, limit: 1, cursor: first.nextCursor })).error.code, "INVALID_CURSOR");
});

test("F02: cursor는 credential/query/snapshot/만료에 묶이고 변조를 거절한다", () => {
  let now = 0; const pager = new CursorPager(() => now);
  const items = [{ id: 1 }, { id: 2 }];
  const { nextCursor } = pager.page(items, "credential", { query: "q" }, 1);
  assert.equal(pager.page(items, "credential", { query: "q" }, 1, nextCursor).items[0].id, 2);
  for (const [data, credential, scope, cursor] of [
    [items, "other", { query: "q" }, nextCursor], [items, "credential", { query: "other" }, nextCursor],
    [[...items, { id: 3 }], "credential", { query: "q" }, nextCursor], [items, "credential", { query: "q" }, nextCursor + "x"],
  ]) assert.throws(() => pager.page(data, credential, scope, 1, cursor), (error) => error.detail.code === "INVALID_CURSOR");
  now = 600001;
  assert.throws(() => pager.page(items, "credential", { query: "q" }, 1, nextCursor), (error) => error.detail.code === "INVALID_CURSOR");
});
