import { z } from "zod";

export const AGENT_LIMITS = {
  jsonBytes: 2 * 1024 * 1024, textLength: 100_000, batchSize: 50,
  listDefault: 50, listMax: 100, cursorLifetimeMs: 10 * 60_000,
  previewBytes: 4 * 1024 * 1024, previewEdgePx: 2048,
  pdfBytes: 20 * 1024 * 1024, artifactBudgetBytes: 100 * 1024 * 1024,
  artifactLifetimeMs: 24 * 60 * 60_000,
} as const;
const object = z.strictObject;
export const opaqueIdSchema = z.string().min(1).max(256);
const id = opaqueIdSchema;
const text = z.string().max(AGENT_LIMITS.textLength);
const name = z.string().trim().min(1).max(200);
const index = z.number().int().nonnegative();
const finite = z.number().finite();
const nonnegative = finite.nonnegative();
const requestId = z.uuid();
const revision = z.string().min(1).max(256);

export const editTargetSchema = z.discriminatedUnion("kind", [
  object({ kind: z.literal("node"), nodeId: id }),
  object({ kind: z.literal("component-prop"), instanceNodeId: id, propId: id }),
  object({ kind: z.literal("repeater-item-prop"), repeaterNodeId: id, itemId: id, propId: id }),
]);
export const colorSchema = z.discriminatedUnion("kind", [
  object({ kind: z.literal("hex"), value: z.string().regex(/^#[0-9a-f]{6}$/i) }),
  object({ kind: z.literal("token"), token: z.string().regex(/^[a-z][a-z0-9.-]*$/i).max(200) }),
]);
export const richTextSchema = object({ runs: z.array(object({
  text,
  marks: z.array(z.discriminatedUnion("type", [
    object({ type: z.literal("bold") }), object({ type: z.literal("italic") }),
    object({ type: z.literal("underline") }), object({ type: z.literal("strike") }),
    object({ type: z.literal("link"), href: text }),
    object({ type: z.literal("color"), color: colorSchema }),
  ])).optional(),
})).max(AGENT_LIMITS.textLength) }).refine(
  (value) => value.runs.reduce((size, run) => size + run.text.length, 0) <= AGENT_LIMITS.textLength,
  "Rich text exceeds the text limit",
);
export const directEditValueSchema = z.union([text, richTextSchema]);
export const imageValueSchema = object({ assetId: id.optional(), alt: text });
export const componentPropValueSchema = z.union([
  text, finite, z.boolean(), richTextSchema, imageValueSchema,
]);
const leaf = <T extends z.ZodType>(schema: T) => schema.nullable().optional();
export const stylePatchSchema = object({
  layout: object({
    direction: leaf(z.enum(["row", "column"])), gapPt: leaf(nonnegative),
    paddingPt: leaf(z.tuple([nonnegative, nonnegative, nonnegative, nonnegative])),
    align: leaf(z.enum(["start", "center", "end", "stretch"])),
    justify: leaf(z.enum(["start", "center", "end", "between"])),
    width: leaf(z.discriminatedUnion("mode", [
      object({ mode: z.literal("auto") }), object({ mode: z.literal("fill") }),
      object({ mode: z.literal("fixed"), valuePt: nonnegative }),
    ])),
    heightPt: leaf(nonnegative), grow: leaf(nonnegative),
    position: leaf(z.enum(["relative", "absolute"])),
    topPt: leaf(finite), rightPt: leaf(finite), bottomPt: leaf(finite), leftPt: leaf(finite),
  }).optional(),
  typography: object({
    fontFamily: leaf(z.string().trim().min(1).max(200)), fontSizePt: leaf(finite.positive()),
    lineHeight: leaf(finite.positive()), fontWeight: leaf(finite.int().min(1).max(1000)),
    color: leaf(colorSchema),
  }).optional(),
  markdown: object({ listItemGapPt: leaf(nonnegative) }).optional(),
  decoration: object({
    background: leaf(colorSchema), borderColor: leaf(colorSchema), borderWidthPt: leaf(nonnegative),
    borderEdges: leaf(z.array(z.enum(["top", "right", "bottom", "left"])).max(4)), radiusPt: leaf(nonnegative),
  }).optional(),
  pagination: object({
    keepTogether: leaf(z.boolean()), keepWithNext: leaf(z.boolean()), forcePageBreakBefore: leaf(z.boolean()),
  }).optional(),
});
export const newNodeSchema = z.discriminatedUnion("type", [
  object({ type: z.literal("container"), name }),
  object({ type: z.literal("text"), name, value: text }),
  object({ type: z.literal("rich-text"), name, value: richTextSchema }),
  object({ type: z.literal("markdown"), name, source: text }),
  object({ type: z.literal("image"), name, assetId: id, alt: text }),
  object({ type: z.literal("repeater"), name, itemComponentId: id }),
]);
export const operationSchema = z.discriminatedUnion("type", [
  object({ type: z.literal("set_edit_value"), target: editTargetSchema, value: directEditValueSchema }),
  object({ type: z.literal("replace_text"), target: editTargetSchema, oldText: text.min(1), newText: text }),
  object({ type: z.literal("add_node"), parentId: id, node: newNodeSchema, index: index.optional() }),
  object({ type: z.literal("move_node"), nodeId: id, parentId: id, index: index.optional() }),
  object({ type: z.literal("duplicate_node"), nodeId: id, parentId: id, index: index.optional() }),
  object({ type: z.literal("set_visibility"), nodeId: id, visible: z.boolean() }),
  object({ type: z.literal("archive_node"), nodeId: id }),
  object({ type: z.literal("restore_node"), nodeId: id }),
  object({ type: z.literal("update_node_style"), nodeId: id, patch: stylePatchSchema }),
  object({ type: z.literal("set_component_prop"), instanceNodeId: id, propId: id, value: componentPropValueSchema }),
  object({ type: z.literal("clear_component_prop"), instanceNodeId: id, propId: id }),
  object({ type: z.literal("add_item"), repeaterNodeId: id, index: index.optional() }),
  object({ type: z.literal("move_item"), repeaterNodeId: id, itemId: id, index }),
  object({ type: z.literal("duplicate_item"), repeaterNodeId: id, itemId: id }),
  object({ type: z.literal("remove_item"), repeaterNodeId: id, itemId: id }),
  object({ type: z.literal("set_item_prop"), repeaterNodeId: id, itemId: id, propId: id, value: componentPropValueSchema }),
  object({ type: z.literal("import_component"), libraryItemId: id, expectedLibraryRevision: revision }),
  object({ type: z.literal("add_component_instance"), parentId: id, componentId: id, name, index: index.optional() }),
]);
export const OPERATION_NAMES = operationSchema.options.map((schema) => schema.shape.type.value);
const pagination = { cursor: z.string().min(1).max(2048).optional(), limit: z.number().int().min(1).max(100).default(50) };
const listing = { query: z.string().max(200).optional(), ...pagination };
const applyFields = { documentId: id, expectedRevision: revision, operations: z.array(operationSchema).min(1).max(50) };
export const pdfFilenameSchema = z.string().min(5).max(120).regex(/^[^/\\\x00-\x1f\x7f]+\.pdf$/i);
export const toolInputSchemas = {
  get_context: object({}),
  list_documents: object(listing),
  get_document: object({ documentId: id, view: z.enum(["outline", "canonical"]).default("outline") }),
  list_edit_targets: object({ documentId: id, ...pagination }),
  get_edit_value: object({ documentId: id, target: editTargetSchema }),
  create_document: object({ name, requestId }),
  apply_operations: z.union([
    object({ ...applyFields, dryRun: z.literal(true) }),
    object({ ...applyFields, dryRun: z.literal(false).default(false), requestId }),
  ]),
  list_components: object(listing),
  get_component: z.discriminatedUnion("source", [
    object({ source: z.literal("library"), libraryItemId: id }),
    object({ source: z.literal("document"), documentId: id, componentId: id }),
  ]),
  preview_document: object({ documentId: id, expectedRevision: revision, page: z.number().int().positive().default(1) }),
  export_pdf: object({ documentId: id, expectedRevision: revision, filename: pdfFilenameSchema.optional(), requestId }),
  get_operation: object({ requestId }),
} as const;
export const ERROR_CODES = [
  "NOT_FOUND_OR_DENIED", "CAPABILITY_DENIED", "INVALID_TARGET", "VALIDATION_FAILED", "UNSUPPORTED_OPERATION",
  "REVISION_CONFLICT", "DOCUMENT_BUSY", "TEXT_NOT_FOUND", "AMBIGUOUS_TEXT", "REQUEST_ID_REUSED",
  "PERSISTENCE_FAILED", "OPERATION_RECOVERY_REQUIRED", "RENDER_FAILED", "PAGE_OUT_OF_RANGE",
  "ARTIFACT_EXPIRED", "RESULT_TOO_LARGE", "INVALID_CURSOR",
] as const;
export const commandErrorSchema = object({
  code: z.enum(ERROR_CODES), message: z.string(), retryable: z.boolean(),
  details: z.record(z.string(), z.json()).optional(),
});
export function toolResultSchema<T extends z.ZodType>(data: T) {
  return z.union([
    object({ ok: z.literal(true), data }),
    object({ ok: z.literal(false), error: commandErrorSchema }),
  ]);
}
export const changesSchema = object({
  affectedNodeIds: z.array(id), affectedTargets: z.array(editTargetSchema),
  removedItemIds: z.array(id), summary: z.string(),
});
export const operationResultSchema = object({
  operationIndex: index, type: z.enum(OPERATION_NAMES as [string, ...string[]]),
  created: object({ nodeId: id.optional(), itemId: id.optional(), componentId: id.optional(), styleId: id.optional() }).optional(),
  idMap: z.record(z.string(), id).optional(),
});
export const pendingSchema = object({ requestId, status: z.literal("pending") });
export const applyResultSchema = z.union([
  pendingSchema,
  object({ documentId: id, baseRevision: revision, dryRun: z.literal(true), persisted: z.literal(false), changes: changesSchema, warnings: z.array(z.string()) }),
  object({ requestId, status: z.literal("completed"), documentId: id, previousRevision: revision, revision,
    persisted: z.literal(true), uiSynced: z.boolean(), changes: changesSchema, results: z.array(operationResultSchema) }),
]);
export const createResultSchema = z.union([pendingSchema, object({
  requestId, status: z.literal("completed"), documentId: id, rootNodeId: id, revision, persisted: z.literal(true),
})]);
export const exportResultSchema = object({
  documentId: id, revision, artifactId: id, uri: z.string(), filename: pdfFilenameSchema,
  mimeType: z.literal("application/pdf"), byteSize: nonnegative.int().max(AGENT_LIMITS.pdfBytes),
  expiresAt: z.iso.datetime(), warnings: z.array(z.string()),
});
export const exportToolResultSchema = z.union([pendingSchema, object({
  requestId, status: z.literal("completed"), ...exportResultSchema.shape,
})]);
export const journalResultSchema = object({
  requestId, tool: z.enum(["create_document", "apply_operations", "export_pdf"]),
  status: z.enum(["pending", "completed", "failed", "recovery_required"]),
  outcome: z.enum(["not_committed", "committed", "unknown"]),
  result: z.union([createResultSchema, applyResultSchema, exportResultSchema]).optional(),
  error: commandErrorSchema.optional(),
});
