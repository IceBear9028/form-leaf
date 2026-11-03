import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer, request } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { AccessPolicy, emptyGrants } from "../src/main/mcp/accessPolicy.ts";
import { AgentServer } from "../src/main/mcp/server.ts";
import { createAgentProtocol } from "../src/main/mcp/tools.ts";
import { DocumentService } from "../src/main/application/documentService.ts";
import { DocumentRepository } from "../src/main/document/documentRepository.ts";
import { ComponentLibraryRepository } from "../src/main/document/componentLibraryRepository.ts";

async function fixture(t) {
  const workspace = await mkdtemp(join(tmpdir(), "formleaf-agent-access-"));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const probe = createServer(); await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port; await new Promise((resolve) => probe.close(resolve));
  const policy = new AccessPolicy(workspace, port); await policy.initialize();
  const service = new DocumentService(new DocumentRepository(workspace), new ComponentLibraryRepository(workspace), workspace);
  service.setCreatedGrantHandler((id, documentId) => policy.grantCreated(id, documentId));
  await service.initialize();
  return { workspace, policy, service, port };
}
const code = (code) => (error) => error.detail?.code === code;

test("F01: 기본 거절·영속 hash·token 폐기·create/write 연동", async (t) => {
  const { workspace, policy, port } = await fixture(t);
  assert.equal(policy.settings().enabled, false);
  const { connection, token } = await policy.create("개인 연결");
  assert.deepEqual(connection.grants, emptyGrants());
  assert.equal(policy.authenticate(token), undefined);
  await policy.setEnabled(true);
  assert.equal(policy.authenticate(token), connection.id);
  assert.equal(policy.authenticate(token + "x"), undefined);
  const stored = await readFile(join(workspace, "agent-settings.json"), "utf8");
  assert.equal(stored.includes(token), false);
  assert.equal((await stat(join(workspace, "agent-settings.json"))).mode & 0o777, 0o600);
  assert.throws(() => policy.document(connection.id, "hidden"), code("NOT_FOUND_OR_DENIED"));
  await policy.setGrants(connection.id, { ...emptyGrants(), documentIds: ["visible"], write: true, create: true });
  assert.equal(policy.capability(connection.id, "create").create, true);
  await policy.setGrants(connection.id, { ...policy.current(connection.id), write: false });
  assert.equal(policy.current(connection.id).create, false);
  assert.throws(() => policy.document(connection.id, "visible", "write"), code("CAPABILITY_DENIED"));
  const restored = new AccessPolicy(workspace, port); await restored.initialize();
  assert.equal(restored.authenticate(token), connection.id);
  await policy.revoke(connection.id);
  assert.equal(policy.authenticate(token), undefined);
  assert.throws(() => policy.current(connection.id), code("NOT_FOUND_OR_DENIED"));
});

test("F01: 실제 Streamable HTTP 인증·Host/Origin·크기 제한·현재 권한", async (t) => {
  const { policy, service, port } = await fixture(t);
  const { connection, token } = await policy.create("HTTP client"); await policy.setEnabled(true);
  const server = new AgentServer(policy, (id) => createAgentProtocol(policy, service, id, "test"));
  await server.start(); t.after(() => server.stop());
  const url = new URL(server.status().endpoint);
  const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${token}` };
  assert.equal((await fetch(url, { method: "POST", headers: { ...headers, Authorization: "Bearer wrong" }, body: "{}" })).status, 401);
  assert.equal((await fetch(url, { method: "POST", headers: { ...headers, Origin: "https://example.com" }, body: "{}" })).status, 403);
  const badHost = await new Promise((resolve, reject) => {
    const req = request(url, { method: "POST", headers: { ...headers, Host: `evil.invalid:${port}` } }, (res) => { res.resume(); resolve(res.statusCode); });
    req.on("error", reject); req.end("{}");
  });
  assert.equal(badHost, 403);
  assert.equal((await fetch(url, { method: "POST", headers, body: " ".repeat(2 * 1024 * 1024 + 1) })).status, 413);
  const client = new Client({ name: "test-client", version: "1" });
  t.after(() => client.close());
  await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const list = await client.listTools();
  assert.equal(list.tools.some((tool) => tool.name === "get_context"), true);
  const context = await client.callTool({ name: "get_context", arguments: {} });
  assert.deepEqual(context.structuredContent.data.capabilities.documentIds, []);
  assert.equal(context.structuredContent.data.activeDocument, null);
  await policy.setGrants(connection.id, { ...emptyGrants(), documentIds: ["new-permission"] });
  const changed = await client.callTool({ name: "get_context", arguments: {} });
  assert.deepEqual(changed.structuredContent.data.capabilities.documentIds, ["new-permission"]);
  await policy.revoke(connection.id);
  await assert.rejects(client.listTools());
});
