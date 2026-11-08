import * as Check from "./fixtures/assertions.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { operationSchema, OPERATION_NAMES, toolInputSchemas, stylePatchSchema } from "../src/foundation/documentCommandSchemas.ts";
import { toolOutputSchemas } from "../src/foundation/documentToolResults.ts";
import { toolDefinition, encodeToolResult } from "../src/main/mcp/protocol.ts";
import { documentRevision, requestHash } from "../src/main/application/documentRevision.ts";

const target = { kind: "node" as const, nodeId: "node-one" };
const operations = [
  { type: "set_edit_value" as const, target, value: "안녕" },
  { type: "replace_text" as const, target, oldText: "안녕", newText: "안녕하세요" },
  { type: "add_node" as const, parentId: "root", node: { type: "markdown" as const, name: "본문", source: "# 내용" } },
  { type: "move_node" as const, nodeId: "one", parentId: "root", index: 0 },
  { type: "duplicate_node" as const, nodeId: "one", parentId: "root" },
  { type: "set_visibility" as const, nodeId: "one", visible: false },
  { type: "archive_node" as const, nodeId: "one" }, { type: "restore_node" as const, nodeId: "one" },
  { type: "update_node_style" as const, nodeId: "one", patch: { typography: { fontSizePt: 12, color: null } } },
  { type: "set_component_prop" as const, instanceNodeId: "instance", propId: "prop", value: true },
  { type: "clear_component_prop" as const, instanceNodeId: "instance", propId: "prop" },
  { type: "add_item" as const, repeaterNodeId: "repeater" },
  { type: "move_item" as const, repeaterNodeId: "repeater", itemId: "item", index: 0 },
  { type: "duplicate_item" as const, repeaterNodeId: "repeater", itemId: "item" },
  { type: "remove_item" as const, repeaterNodeId: "repeater", itemId: "item" },
  { type: "set_item_prop" as const, repeaterNodeId: "repeater", itemId: "item", propId: "prop", value: { runs: [{ text: "Text", marks: [{ type: "bold" as const }] }] } },
  { type: "import_component" as const, libraryItemId: "library", expectedLibraryRevision: "rev" },
  { type: "add_component_instance" as const, parentId: "root", componentId: "component", name: "컴포넌트" },
];
await test("계약: 18명령 전체 정상 입력과 알 수 없는 키를 검증한다", () => {
  assert.deepEqual(operations.map((op) => op.type), OPERATION_NAMES);
  for (const operation of operations) {
    assert.equal(operationSchema.safeParse(operation).success, true, operation.type);
    assert.equal(operationSchema.safeParse({ ...Check.present(operation, 'fixture spread'), path: "/tmp/file" }).success, false, operation.type);
  }
  for (const kind of [
    target, { kind: "component-prop" as const, instanceNodeId: "i", propId: "p" },
    { kind: "repeater-item-prop" as const, repeaterNodeId: "r", itemId: "i", propId: "p" },
  ]) assert.equal(operationSchema.safeParse({ type: "set_edit_value" as const, target: kind, value: "한글" }).success, true);
});
await test("F03/F06: 중첩 키, raw CSS, 잘못된 index/크기/유형을 거절한다", () => {
  for (const operation of [
    { ...Check.present(operations[0], 'fixture spread'), target: { ...target, anchorRenderId: "block" } },
    { ...Check.present(operations[0], 'fixture spread'), value: "a".repeat(100001) },
    { ...Check.present(operations[1], 'fixture spread'), oldText: "" },
    { ...Check.present(operations[2], 'fixture spread'), node: { ...Check.present(Check.present(operations[2], 'fixture value').node, 'fixture spread'), childIds: [] } },
    { ...Check.present(operations[3], 'fixture spread'), index: -1 }, { ...Check.present(operations[3], 'fixture spread'), index: 0.5 },
    { ...Check.present(operations[0], 'fixture spread'), value: { runs: [{ text: "x", marks: [{ type: "script" as const }] }] } },
    { ...Check.present(operations[0], 'fixture spread'), value: { runs: [{ text: "a".repeat(50001) }, { text: "b".repeat(50000) }] } },
  ]) assert.equal(operationSchema.safeParse(operation).success, false);
  for (const patch of [
    { css: "color:red" }, { typography: null }, { typography: { fontSizePt: 0 } },
    { layout: { width: { mode: "auto" as const, valuePt: 4 } } }, { layout: { gapPt: Infinity } },
    { decoration: { background: { kind: "hex" as const, value: "red" } } }, { layout: { paddingPt: [1, 2] } },
    { typography: { fontWeight: 1001 } }, { typography: { color: { kind: "hex" as const, value: "#ffffff", url: "x" } } },
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
await test("12도구의 기본값과 JSON schema, output error union이 일치한다", () => {
  assert.equal(Object.keys(inputs).length, 12);
  for (const name of Object.keys(toolInputSchemas) as Array<keyof typeof toolInputSchemas>) {
    const schema = toolInputSchemas[name];
    assert.equal(schema.safeParse(inputs[name]).success, true, name);
    assert.equal(schema.safeParse({ ...inputs[name], unsafe: true }).success, false);
    const definition = toolDefinition(name, name);
    assert.equal(definition.inputSchema.type, "object");
    for (const keyword of ["anyOf", "oneOf", "allOf"]) assert.equal(keyword in definition.inputSchema, false, `${name}: model-facing root must be an object`);
    assert.equal(Check.present(definition.outputSchema, 'fixture value').type, "object");
    assert.equal(toolOutputSchemas[name].safeParse({ ok: false, error: { code: "NOT_FOUND_OR_DENIED", message: "거절", retryable: false } }).success, true);
  }
  assert.equal(toolInputSchemas.list_documents.parse({}).limit, 50);
  assert.equal(toolInputSchemas.create_document.parse(inputs.create_document).name, "새 문서");
  assert.equal(toolInputSchemas.get_document.parse(inputs.get_document).view, "outline");
  assert.match(Check.string(Check.property(Check.present(Check.present(Check.present(toolDefinition("apply_operations", "apply").inputSchema, 'fixture value').properties, 'fixture value').requestId, 'fixture value'), "description")), /Required.*real writes/);
  assert.match(Check.string(Check.property(Check.present(Check.present(Check.present(toolDefinition("get_component", "component").inputSchema, 'fixture value').properties, 'fixture value').libraryItemId, 'fixture value'), "description")), /source=library/);
  assert.equal(toolInputSchemas.get_component.safeParse({ source: "library", libraryItemId: "l", documentId: "d" }).success, false);
  assert.equal(toolInputSchemas.get_component.safeParse({ source: "document", documentId: "d" }).success, false);
});
await test("F03/F07/F08: dryRun에는 requestId 금지, PDF에는 경로 금지, batch 한도", () => {
  const base = { ...Check.present(inputs.apply_operations, 'fixture spread'), dryRun: true };
  assert.equal(toolInputSchemas.apply_operations.safeParse(base).success, false);
  Reflect.deleteProperty(base, "requestId");
  assert.equal(toolInputSchemas.apply_operations.safeParse(base).success, true);
  assert.equal(toolInputSchemas.apply_operations.safeParse({ ...Check.present(base, 'fixture spread'), operations: [] }).success, false);
  assert.equal(toolInputSchemas.apply_operations.safeParse({ ...Check.present(base, 'fixture spread'), operations: Array(51).fill(operations[0]) }).success, false);
  for (const filename of ["../out.pdf", "/out.pdf", "a\\b.pdf", "a\n.pdf", "out.txt", ".", "..", "a".repeat(121) + ".pdf"]) {
    assert.equal(toolInputSchemas.export_pdf.safeParse({ ...inputs.export_pdf, filename }).success, false, filename);
  }
});
await test("F08: hash는 키 순서와 requestId에 무관하며 값·배열 순서·도구명을 구별한다", () => {
  assert.equal(documentRevision({ a: 1, b: 2 }), documentRevision({ b: 2, a: 1 }));
  assert.notEqual(documentRevision([1, 2]), documentRevision([2, 1]));
  assert.equal(requestHash("create", { name: "test", requestId: "a" }), requestHash("create", { requestId: "b", name: "test" }));
  assert.notEqual(requestHash("create", { name: "test" }), requestHash("edit", { name: "test" }));
});
await test("고정 SDK: structuredContent/text, 오류, image, resource를 client까지 전달한다", async (t) => {
  const server = new Server({ name: "formleaf-contract-test", version: "1" }, { capabilities: { tools: {}, resources: {} } });
  const client = new Client({ name: "contract-client", version: "1" });
  t.after(() => Promise.all([client.close(), server.close()]));
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [toolDefinition("preview_document", "Preview")] }));
  server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
    if (Check.present(params.arguments, 'fixture value').page === 2) return encodeToolResult("preview_document", { ok: false, error: { code: "PAGE_OUT_OF_RANGE", message: "페이지 없음", retryable: false } });
    const result = encodeToolResult("preview_document", { ok: true, data: { documentId: "d", revision: "r", page: 1, pageCount: 1, widthPx: 10, heightPx: 10, mimeType: "image/png", warnings: [] } });
    result.content.push({ type: "image" as const, mimeType: "image/png", data: Buffer.from("fixture").toString("base64") });
    return result;
  });
  server.setRequestHandler(ReadResourceRequestSchema, async ({ params }) => ({ contents: [{ uri: params.uri, mimeType: "application/pdf", blob: Buffer.from("%PDF-fixture").toString("base64") }] }));
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  await client.listTools();
  const result = Check.wireResult(await client.callTool({ name: "preview_document", arguments: { documentId: "d", expectedRevision: "r" } }));
  assert.deepEqual(JSON.parse(Check.string(Check.property(Check.present(result.content[0], "text content"), "text"))), Check.toolResult("preview_document", Check.toolResult("preview_document", result.structuredContent)));
  assert.equal(Check.present(result.content[1], "image content").type, "image");
  const error = Check.wireResult(await client.callTool({ name: "preview_document", arguments: { documentId: "d", expectedRevision: "r", page: 2 } }));
  assert.equal(error.isError, true);
  assert.equal(Check.failed(Check.toolResult("preview_document", error.structuredContent)).error.code, "PAGE_OUT_OF_RANGE");
  const resource = await client.readResource({ uri: "formleaf://artifacts/fixture" });
  assert.equal(Buffer.from(Check.field(Check.present(resource.contents[0], 'fixture value'), 'blob').blob, "base64").toString(), "%PDF-fixture");
});
