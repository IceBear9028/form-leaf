import { test, expect, _electron as electron, type ElectronApplication } from "@playwright/test";
import electronPath from "electron";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { DocumentRepository } from "../src/main/document/documentRepository.ts";
import { AccessPolicy, emptyGrants } from "../src/main/mcp/accessPolicy.ts";
import { agentDocument } from "../test/fixtures/agent-document.mjs";

test("F03: 실제 MCP 내용 변경·저장·화면 ack와 composition 중 busy 거절", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "formleaf-agent-content-e2e-"));
  const userData = join(temporary, "user-data"); const workspace = join(userData, "workspaces");
  const repository = new DocumentRepository(workspace); const created = await repository.create();
  const fixture = agentDocument(created.document); fixture.name = "MCP 내용 테스트"; fixture.nodes.markdown.source = "직접 입력"; fixture.nodes.markdown.visible = true;
  await repository.save(fixture.documentId, fixture);
  const policy = new AccessPolicy(workspace); await policy.initialize();
  const { connection, token } = await policy.create("작성 에이전트");
  await policy.setGrants(connection.id, { ...emptyGrants(), documentIds: [fixture.documentId], write: true }); await policy.setEnabled(true);
  const client = new Client({ name: "content-e2e", version: "1" }); let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({ executablePath: electronPath as unknown as string, args: ["."], cwd: process.cwd(), env: { ...process.env, DOCUMENT_USER_DATA_DIRECTORY: userData, DOCUMENT_E2E_HEADLESS: "1" } });
    const page = await app.firstWindow();
    await page.getByRole("button", { name: /MCP 내용 테스트/ }).click();
    const target = page.locator('.document-page-stack--screen [data-document-node-id="markdown"][data-document-edit-target="true"]');
    await expect(target).toBeVisible();
    await client.connect(new StreamableHTTPClientTransport(new URL("http://127.0.0.1:32516/mcp"), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
    const read = async () => (await client.callTool({ name: "get_document", arguments: { documentId: fixture.documentId } })).structuredContent as any;
    const initial = await read();
    const operations = [
      { type: "set_edit_value", target: { kind: "node", nodeId: "markdown" }, value: "외부 본문" },
      { type: "set_edit_value", target: { kind: "component-prop", instanceNodeId: "instance", propId: "prop" }, value: "외부 컴포넌트" },
      { type: "set_edit_value", target: { kind: "repeater-item-prop", repeaterNodeId: "repeater", itemId: "item", propId: "prop" }, value: "외부 항목" },
    ];
    const applied = (await client.callTool({ name: "apply_operations", arguments: { documentId: fixture.documentId, expectedRevision: initial.data.revision, requestId: randomUUID(), operations } })).structuredContent as any;
    expect(applied.ok, JSON.stringify(applied)).toBe(true); expect(applied.data.uiSynced).toBe(true);
    await expect(target).toContainText("외부 본문");
    await target.locator("p").click();
    const editor = page.locator('[data-markdown-editor-host] .ProseMirror');
    await expect(editor).toBeFocused();
    await editor.evaluate((element) => { (window as any).agentRoot = element; });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.imeSetComposition", { text: "한", selectionStart: 1, selectionEnd: 1 });
    const blocked = (await client.callTool({ name: "apply_operations", arguments: { documentId: fixture.documentId, expectedRevision: applied.data.revision, requestId: randomUUID(), operations } })).structuredContent as any;
    expect(blocked.error.code).toBe("DOCUMENT_BUSY");
    expect(await editor.evaluate((element) => (window as any).agentRoot === element)).toBe(true); await expect(editor).toBeFocused();
    await cdp.send("Input.insertText", { text: "한" }); await cdp.detach();
    await page.getByRole("button", { name: "확대", exact: true }).click();
    await expect.poll(async () => (await read()).data.hasUnsavedChanges).toBe(false);
    const persisted = await repository.load(fixture.documentId);
    expect(persisted.nodes.instance.type === "component-instance" && persisted.nodes.instance.props.prop).toBe("외부 컴포넌트");
    expect(persisted.nodes.repeater.type === "repeater" && persisted.nodes.repeater.items[0].props.prop).toBe("외부 항목");
    expect(persisted.components.component.propDefinitions[0].defaultValue).toBe("기본 **원문**");
  } finally { await client.close(); await app?.close(); await rm(temporary, { recursive: true, force: true }); }
});
