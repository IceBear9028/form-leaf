import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { operationSchema, OPERATION_NAMES, toolInputSchemas, stylePatchSchema, AGENT_LIMITS } from "../src/foundation/documentCommandSchemas.ts";
import { toolOutputSchemas } from "../src/foundation/documentToolResults.ts";
import { toolDefinition, encodeToolResult } from "../src/main/mcp/protocol.ts";
import { documentRevision, requestHash } from "../src/main/application/documentRevision.ts";

const target = { kind: "node", nodeId: "node-one" };
const operations = [
  { type: "set_edit_value", target, value: "안녕" },
  { type: "replace_text", target, oldText: "안녕", newText: "안녕하세요" },
  { type: "add_node", parentId: "root", node: { type: "markdown", name: "본문", source: "# 내용" } },
  { type: "move_node", nodeId: "one", parentId: "root", index: 0 },
  { type: "duplicate_node", nodeId: "one", parentId: "root" },
  { type: "set_visibility", nodeId: "one", visible: false },
  { type: "archive_node", nodeId: "one" }, { type: "restore_node", nodeId: "one" },
  { type: "update_node_style", nodeId: "one", patch: { typography: { fontSizePt: 12, color: null } } },
  { type: "set_component_prop", instanceNodeId: "instance", propId: "prop", value: true },
  { type: "clear_component_prop", instanceNodeId: "instance", propId: "prop" },
  { type: "add_item", repeaterNodeId: "repeater" },
  { type: "move_item", repeaterNodeId: "repeater", itemId: "item", index: 0 },
  { type: "duplicate_item", repeaterNodeId: "repeater", itemId: "item" },
  { type: "remove_item", repeaterNodeId: "repeater", itemId: "item" },
  { type: "set_item_prop", repeaterNodeId: "repeater", itemId: "item", propId: "prop", value: { runs: [{ text: "Text", marks: [{ type: "bold" }] }] } },
  { type: "import_component", libraryItemId: "library", expectedLibraryRevision: "rev" },
  { type: "add_component_instance", parentId: "root", componentId: "component", name: "컴포넌트" },
];
test("계약: 18명령 전체 정상 입력과 알 수 없는 키를 검증한다", () => {
  assert.deepEqual(operations.map((op) => op.type), OPERATION_NAMES);
  for (const operation of operations) {
    assert.equal(operationSchema.safeParse(operation).success, true, operation.type);
    assert.equal(operationSchema.safeParse({ ...operation, path: "/tmp/file" }).success, false, operation.type);
  }
  for (const kind of [
    target, { kind: "component-prop", instanceNodeId: "i", propId: "p" },
    { kind: "repeater-item-prop", repeaterNodeId: "r", itemId: "i", propId: "p" },
  ]) assert.equal(operationSchema.safeParse({ type: "set_edit_value", target: kind, value: "한글" }).success, true);
});
test("F03/F06: 중첩 키, raw CSS, 잘못된 index/크기/유형을 거절한다", () => {
  for (const operation of [
    { ...operations[0], target: { ...target, anchorRenderId: "block" } },
    { ...operations[0], value: "a".repeat(100001) },
    { ...operations[1], oldText: "" },
    { ...operations[2], node: { ...operations[2].node, childIds: [] } },
    { ...operations[3], index: -1 }, { ...operations[3], index: 0.5 },
    { ...operations[0], value: { runs: [{ text: "x", marks: [{ type: "script" }] }] } },
    { ...operations[0], value: { runs: [{ text: "a".repeat(50001) }, { text: "b".repeat(50000) }] } },
  ]) assert.equal(operationSchema.safeParse(operation).success, false);
  for (const patch of [
    { css: "color:red" }, { typography: null }, { typography: { fontSizePt: 0 } },
    { layout: { width: { mode: "auto", valuePt: 4 } } }, { layout: { gapPt: Infinity } },
    { decoration: { background: { kind: "hex", value: "red" } } }, { layout: { paddingPt: [1, 2] } },
    { typography: { fontWeight: 1001 } }, { typography: { color: { kind: "hex", value: "#ffffff", url: "x" } } },
  ]) assert.equal(stylePatchSchema.safeParse(patch).success, false);
  assert.equal(stylePatchSchema.safeParse({ layout: { topPt: -10, width: null } }).success, true);
});
const inputs = {
  get_context: {}, list_documents: {}, get_document: { documentId: "document" },
  list_edit_targets: { documentId: "document" }, get_edit_value: { documentId: "document", target },
  create_document: { name: " 새 문서 ", requestId: randomUUID() },
  apply_operations: { documentId: "document", expectedRevision: "rev", operations, requestId: randomUUID() },
  list_components: {}, get_component: { source: "library", libraryItemId: "library" },
  preview_document: { documentId: "document", expectedRevision: "rev" },
  export_pdf: { documentId: "document", expectedRevision: "rev", requestId: randomUUID() },
  get_operation: { requestId: randomUUID() },
};
test("12도구의 기본값과 JSON schema, output error union이 일치한다", () => {
  assert.equal(Object.keys(inputs).length, 12);
  for (const [name, schema] of Object.entries(toolInputSchemas)) {
    assert.equal(schema.safeParse(inputs[name]).success, true, name);
    assert.equal(schema.safeParse({ ...inputs[name], unsafe: true }).success, false);
    const definition = toolDefinition(name, name);
    assert.equal(definition.inputSchema.type, "object");
    assert.equal(definition.outputSchema.type, "object");
    assert.equal(toolOutputSchemas[name].safeParse({ ok: false, error: { code: "NOT_FOUND_OR_DENIED", message: "거절", retryable: false } }).success, true);
  }
  assert.equal(toolInputSchemas.list_documents.parse({}).limit, 50);
  assert.equal(toolInputSchemas.create_document.parse(inputs.create_document).name, "새 문서");
  assert.equal(toolInputSchemas.get_document.parse(inputs.get_document).view, "outline");
});
test("F03/F07/F08: dryRun에는 requestId 금지, PDF에는 경로 금지, batch 한도", () => {
  const base = { ...inputs.apply_operations, dryRun: true };
  assert.equal(toolInputSchemas.apply_operations.safeParse(base).success, false);
  delete base.requestId;
  assert.equal(toolInputSchemas.apply_operations.safeParse(base).success, true);
  assert.equal(toolInputSchemas.apply_operations.safeParse({ ...base, operations: [] }).success, false);
  assert.equal(toolInputSchemas.apply_operations.safeParse({ ...base, operations: Array(51).fill(operations[0]) }).success, false);
  for (const filename of ["../out.pdf", "/out.pdf", "a\\b.pdf", "a\n.pdf", "out.txt", ".", "..", "a".repeat(121) + ".pdf"]) {
    assert.equal(toolInputSchemas.export_pdf.safeParse({ ...inputs.export_pdf, filename }).success, false, filename);
  }
});
test("F08: hash는 키 순서와 requestId에 무관하며 값·배열 순서·도구명을 구별한다", () => {
  assert.equal(documentRevision({ a: 1, b: 2 }), documentRevision({ b: 2, a: 1 }));
  assert.notEqual(documentRevision([1, 2]), documentRevision([2, 1]));
  assert.equal(requestHash("create", { name: "test", requestId: "a" }), requestHash("create", { requestId: "b", name: "test" }));
  assert.notEqual(requestHash("create", { name: "test" }), requestHash("edit", { name: "test" }));
});
test("고정 SDK: structuredContent/text, 오류, image, resource를 client까지 전달한다", async (t) => {
  const server = new Server({ name: "formleaf-contract-test", version: "1" }, { capabilities: { tools: {}, resources: {} } });
  const client = new Client({ name: "contract-client", version: "1" });
  t.after(() => Promise.all([client.close(), server.close()]));
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [toolDefinition("preview_document", "Preview")] }));
  server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
    if (params.arguments.page === 2) return encodeToolResult("preview_document", { ok: false, error: { code: "PAGE_OUT_OF_RANGE", message: "페이지 없음", retryable: false } });
    const result = encodeToolResult("preview_document", { ok: true, data: { documentId: "d", revision: "r", page: 1, pageCount: 1, widthPx: 10, heightPx: 10, mimeType: "image/png", warnings: [] } });
    result.content.push({ type: "image", mimeType: "image/png", data: Buffer.from("fixture").toString("base64") });
    return result;
  });
  server.setRequestHandler(ReadResourceRequestSchema, async ({ params }) => ({ contents: [{ uri: params.uri, mimeType: "application/pdf", blob: Buffer.from("%PDF-fixture").toString("base64") }] }));
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  await client.listTools();
  const result = await client.callTool({ name: "preview_document", arguments: { documentId: "d", expectedRevision: "r" } });
  assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
  assert.equal(result.content[1].type, "image");
  const error = await client.callTool({ name: "preview_document", arguments: { documentId: "d", expectedRevision: "r", page: 2 } });
  assert.equal(error.isError, true);
  assert.equal(error.structuredContent.error.code, "PAGE_OUT_OF_RANGE");
  const resource = await client.readResource({ uri: "formleaf://artifacts/fixture" });
  assert.equal(Buffer.from(resource.contents[0].blob, "base64").toString(), "%PDF-fixture");
});
