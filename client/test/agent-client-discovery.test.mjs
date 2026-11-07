import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { AccessPolicy } from "../src/main/mcp/accessPolicy.ts";
import { AgentServer } from "../src/main/mcp/server.ts";
import { createAgentProtocol } from "../src/main/mcp/tools.ts";
import { DocumentService } from "../src/main/application/documentService.ts";
import { DocumentRepository } from "../src/main/document/documentRepository.ts";
import { ComponentLibraryRepository } from "../src/main/document/componentLibraryRepository.ts";

const execute = promisify(execFile);
test("실제 Claude Code CLI가 격리된 설정으로 Formleaf HTTP MCP에 연결하고 폐기를 확인한다", { skip: !process.env.FORMLEAF_CLAUDE_BIN }, async () => {
  const temporary = await mkdtemp(join(tmpdir(), "formleaf-claude-discovery-"));
  const config = join(temporary, "claude-config"); await mkdir(config, { mode: 0o700 });
  const probe = createServer(); await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port; await new Promise((resolve) => probe.close(resolve));
  const workspace = join(temporary, "workspace");
  const policy = new AccessPolicy(workspace, port); await policy.initialize(); await policy.setEnabled(true);
  const { connection, token } = await policy.create("Claude discovery fixture");
  const service = new DocumentService(new DocumentRepository(workspace), new ComponentLibraryRepository(workspace), workspace);
  const server = new AgentServer(policy, (id) => createAgentProtocol(policy, service, id, "acceptance"));
  const env = { ...process.env, CLAUDE_CONFIG_DIR: config, FORMLEAF_MCP_TOKEN: token };
  delete env.ANTHROPIC_API_KEY; delete env.ANTHROPIC_AUTH_TOKEN; delete env.CLAUDE_CODE_OAUTH_TOKEN;
  const run = (...args) => execute(process.env.FORMLEAF_CLAUDE_BIN, args, { cwd: temporary, env, timeout: 20_000, maxBuffer: 1024 * 1024 });
  try {
    await server.start();
    await run("mcp", "add-json", "--scope", "user", "formleaf", JSON.stringify({ type: "http", url: server.status().endpoint, headers: { Authorization: "Bearer ${FORMLEAF_MCP_TOKEN}" } }));
    const before = await run("mcp", "list");
    assert.match(before.stdout, /formleaf.*Connected/i);
    assert.equal(before.stdout.includes(token), false);
    await policy.revoke(connection.id);
    const after = await run("mcp", "list");
    assert.doesNotMatch(after.stdout, /formleaf.*Connected/i);
    assert.match(after.stdout, /formleaf/);
  } finally { await server.stop(); await rm(temporary, { recursive: true, force: true }); }
});
