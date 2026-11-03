import { test, expect, _electron as electron, type ElectronApplication } from "@playwright/test";
import electronPath from "electron";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { DocumentRepository } from "../src/main/document/documentRepository.ts";

test("F01: 연결 UI에서 발급·문서 허용·권한 저장·token 폐기", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "formleaf-agent-connection-"));
  const userData = join(temporary, "user-data");
  const repository = new DocumentRepository(join(userData, "workspaces"));
  const created = await repository.create(); await repository.rename(created.document.documentId, "허용할 문서");
  let app: ElectronApplication | undefined;
  const client = new Client({ name: "ui-test", version: "1" });
  try {
    app = await electron.launch({ executablePath: electronPath as unknown as string, args: ["."], cwd: process.cwd(), env: { ...process.env, DOCUMENT_USER_DATA_DIRECTORY: userData, DOCUMENT_E2E_HEADLESS: "1" } });
    const page = await app.firstWindow();
    await page.getByRole("button", { name: "에이전트 연결", exact: true }).click();
    await expect(page.getByText("연결 꺼짐", { exact: false })).toBeVisible();
    await page.getByRole("textbox", { name: "연결 이름" }).fill("개인 테스트 에이전트");
    await page.getByRole("button", { name: "토큰 발급" }).click();
    const token = await page.getByRole("textbox", { name: "연결 토큰", exact: true }).inputValue();
    expect(token.length).toBeGreaterThan(40);
    await page.getByRole("button", { name: "연결 켜기", exact: true }).click();
    await expect(page.getByText("연결 대기 중", { exact: false })).toBeVisible();
    const settings = await page.evaluate(() => window.documents.agentSettings());
    await client.connect(new StreamableHTTPClientTransport(new URL(settings.endpoint), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
    const before = await client.callTool({ name: "get_context", arguments: {} });
    expect((before.structuredContent as any).data.capabilities.documentIds).toEqual([]);
    await page.getByRole("checkbox", { name: "허용할 문서", exact: true }).check();
    await page.getByRole("checkbox", { name: "새 문서 생성", exact: true }).check();
    await expect(page.getByRole("checkbox", { name: "허용 문서 수정" })).toBeChecked();
    await page.getByRole("button", { name: "권한 저장" }).click();
    await expect.poll(async () => ((await client.callTool({ name: "get_context", arguments: {} })).structuredContent as any).data.capabilities.documentIds).toEqual([created.document.documentId]);
    await page.getByRole("checkbox", { name: "허용 문서 수정" }).uncheck();
    await expect(page.getByRole("checkbox", { name: "새 문서 생성", exact: true })).not.toBeChecked();
    await page.getByRole("button", { name: "권한 저장" }).click();
    await expect(page.getByRole("button", { name: "권한 저장" })).toBeEnabled();
    await page.getByRole("button", { name: "토큰 폐기" }).click();
    await expect(page.getByText("개인 테스트 에이전트 · 폐기됨")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "연결 토큰", exact: true })).toHaveCount(0);
    await expect(async () => client.listTools()).rejects.toThrow();
    await page.getByRole("button", { name: "연결 끄기", exact: true }).click();
    await expect(page.getByText("연결 꺼짐", { exact: false })).toBeVisible();
  } finally { await client.close(); await app?.close(); await rm(temporary, { recursive: true, force: true }); }
});
