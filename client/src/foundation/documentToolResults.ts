import { z } from "zod";
import {
  opaqueIdSchema as id, editTargetSchema, directEditValueSchema, componentPropValueSchema,
  toolResultSchema, createResultSchema, applyResultSchema, exportToolResultSchema, journalResultSchema,
} from "./documentCommandSchemas.ts";
const object = z.strictObject;
const revision = z.string();
const flags = { hasUnsavedChanges: z.boolean(), isEditing: z.boolean() };
const asset = object({ id, name: z.string(), mimeType: z.string() });
const assets = z.array(asset);
// The canonical DTO is read-only and validated by the document model before redaction.
const records = z.record(z.string(), z.json());
const capabilities = object({ documentIds: z.array(id), write: z.boolean(), create: z.boolean(), libraryRead: z.boolean(), render: z.boolean() });
const valueType = z.enum(["text", "markdown", "rich-text"]);
const valueSource = z.enum(["node", "default", "override"]);
const targetItem = object({ target: editTargetSchema, label: z.string(), breadcrumb: z.array(z.string()), valueType, valueSource, supportedOperations: z.array(z.string()) });
const outlineNode = object({
  id, type: z.enum(["container", "text", "rich-text", "markdown", "image", "repeater", "component-instance"]),
  name: z.string(), parentId: id.nullable(), childIds: z.array(id), visible: z.boolean(), archived: z.boolean(),
  componentId: id.optional(), items: z.array(object({ itemId: id, componentId: id, visible: z.boolean() })).optional(),
});
const docBase = { documentId: id, name: z.string(), revision, ...flags };
const componentBase = { componentId: id, name: z.string(), rootNodeId: id,
  propDefinitions: z.array(object({ id, name: z.string(), status: z.enum(["active", "archived"]),
    valueType: z.enum(["text", "rich-text", "markdown", "number", "boolean", "image"]),
    binding: object({ nodeId: id, property: z.enum(["text.value", "rich-text.value", "markdown.source", "image.value"]) }),
    defaultValue: componentPropValueSchema,
  })), nodes: records, styles: records, assets,
};
export const toolDataSchemas = {
  get_context: object({
    apiVersion: z.literal("1"), appVersion: z.string(), schemaVersion: z.literal(4), workspaceId: id, capabilities,
    activeDocument: object({ documentId: id, revision, ...flags }).nullable(),
    selection: object({ documentId: id, target: editTargetSchema.nullable(), nodeId: id.optional() }).nullable(),
    supportedOperations: z.array(z.string()), limits: z.record(z.string(), z.number()),
  }),
  list_documents: object({ items: z.array(object({ documentId: id, name: z.string(), updatedAt: z.string() })), nextCursor: z.string().nullable() }),
  get_document: z.discriminatedUnion("view", [
    object({ ...docBase, view: z.literal("outline"), rootNodeId: id, nodes: z.array(outlineNode) }),
    object({ ...docBase, view: z.literal("canonical"), document: object({
      schemaVersion: z.literal(4), documentId: id, name: z.string(), rootNodeId: id,
      nodes: records, components: records, styles: records, assets, updatedAt: z.string(),
    }) }),
  ]),
  list_edit_targets: object({ documentId: id, revision, items: z.array(targetItem), nextCursor: z.string().nullable() }),
  get_edit_value: object({ documentId: id, revision, target: editTargetSchema, valueType, value: directEditValueSchema, valueSource, ...flags,
    markdownCompatibility: object({ editorSupported: z.boolean(), reasons: z.array(z.string()) }).optional(),
  }),
  create_document: createResultSchema,
  apply_operations: applyResultSchema,
  list_components: object({ items: z.array(object({ libraryItemId: id, name: z.string(), updatedAt: z.string(), libraryRevision: revision })), nextCursor: z.string().nullable() }),
  get_component: z.discriminatedUnion("source", [
    object({ source: z.literal("library"), libraryRevision: revision, ...componentBase }),
    object({ source: z.literal("document"), revision, ...componentBase }),
  ]),
  preview_document: object({ documentId: id, revision, page: z.number().int().positive(), pageCount: z.number().int().positive(),
    widthPx: z.number().int().positive().max(2048), heightPx: z.number().int().positive().max(2048), mimeType: z.literal("image/png"), warnings: z.array(z.string()) }),
  export_pdf: exportToolResultSchema,
  get_operation: journalResultSchema,
} as const;
export const toolOutputSchemas = {
  get_context: toolResultSchema(toolDataSchemas.get_context),
  list_documents: toolResultSchema(toolDataSchemas.list_documents),
  get_document: toolResultSchema(toolDataSchemas.get_document),
  list_edit_targets: toolResultSchema(toolDataSchemas.list_edit_targets),
  get_edit_value: toolResultSchema(toolDataSchemas.get_edit_value),
  create_document: toolResultSchema(toolDataSchemas.create_document),
  apply_operations: toolResultSchema(toolDataSchemas.apply_operations),
  list_components: toolResultSchema(toolDataSchemas.list_components),
  get_component: toolResultSchema(toolDataSchemas.get_component),
  preview_document: toolResultSchema(toolDataSchemas.preview_document),
  export_pdf: toolResultSchema(toolDataSchemas.export_pdf),
  get_operation: toolResultSchema(toolDataSchemas.get_operation),
} as const;
