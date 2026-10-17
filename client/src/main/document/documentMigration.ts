import { createHash } from "node:crypto";
import type {
  ComponentDefinition,
  ComponentPropValue,
  DocumentAsset,
  DocumentData,
  DocumentNode,
  StyleDefinition,
} from "../../foundation/documentModel.ts";
import type { ComponentLibraryPackage } from "../../foundation/documentComponentOperations.ts";
import {
  assertDocumentData,
  validateDocumentData,
  validateDocumentDataForMigration,
} from "../../foundation/documentValidation.ts";
import { upgradeLegacyImportedDocument } from "./legacy/upgradeLegacyImportedDocument.ts";

const LEGACY_ID_PREFIX = "legacy-";

export type DocumentMigrationResult = {
  document: DocumentData;
  migrated: boolean;
};

export function migrateDocumentData(
  value: unknown,
  options: { legacyVisualSource?: DocumentData } = {},
): DocumentMigrationResult {
  if (isRecord(value) && value.schemaVersion === 4) {
    const validation = validateDocumentData(value);
    if (!validation.valid) throw validationError(validation.issues);
    return { document: validation.document, migrated: false };
  }
  if (!isRecord(value) || value.schemaVersion !== 3) {
    throw new Error("지원하지 않는 문서 schemaVersion입니다.");
  }

  const candidate = structuredClone(value) as Record<string, unknown>;
  candidate.schemaVersion = 4;
  const validation = validateDocumentDataForMigration(candidate);
  if (!validation.valid) throw validationError(validation.issues);

  const visuallyUpgraded = options.legacyVisualSource
    ? upgradeLegacyImportedDocument(validation.document, options.legacyVisualSource)
    : validation.document;
  const document = rekeyLegacyDocument(visuallyUpgraded);
  assertDocumentData(document);
  return { document, migrated: true };
}

export function isDocumentDataV3(value: unknown): boolean {
  if (!isRecord(value) || value.schemaVersion !== 3) return false;
  const candidate = structuredClone(value) as Record<string, unknown>;
  candidate.schemaVersion = 4;
  return validateDocumentDataForMigration(candidate).valid;
}

export function rekeyLegacyDocument(document: DocumentData): DocumentData {
  const scope = `document:${document.documentId}`;
  const nodeMap = allocateRecordIds(Object.keys(document.nodes), "node", scope);
  const componentMap = allocateRecordIds(Object.keys(document.components), "component", scope);
  const styleMap = allocateRecordIds(Object.keys(document.styles), "style", scope);
  const assetMap = allocateRecordIds(Object.keys(document.assets), "asset", scope);
  const usedItemIds = new Set(
    Object.values(document.nodes).flatMap((node) => (
      node.type === "repeater"
        ? node.items.filter((item) => !isLegacyId(item.id)).map((item) => item.id)
        : []
    )),
  );

  const nodes: Record<string, DocumentNode> = {};
  Object.values(document.nodes).forEach((source) => {
    const id = mappedId(nodeMap, source.id, "node");
    const common = {
      ...structuredClone(source),
      id,
      styleId: source.styleId ? mappedId(styleMap, source.styleId, "style") : undefined,
      archivedFrom: source.archivedFrom
        ? { ...source.archivedFrom, parentId: mappedId(nodeMap, source.archivedFrom.parentId, "node") }
        : undefined,
    };
    if (source.type === "container") {
      nodes[id] = {
        ...common,
        type: source.type,
        childIds: source.childIds.map((childId) => mappedId(nodeMap, childId, "node")),
      };
    } else if (source.type === "image") {
      nodes[id] = {
        ...common,
        type: source.type,
        alt: source.alt,
        assetId: source.assetId ? mappedId(assetMap, source.assetId, "asset") : undefined,
      };
    } else if (source.type === "component-instance") {
      nodes[id] = {
        ...common,
        type: source.type,
        componentId: mappedId(componentMap, source.componentId, "component"),
        props: remapPropAssets(source.props, assetMap),
      };
    } else if (source.type === "repeater") {
      nodes[id] = {
        ...common,
        type: source.type,
        itemComponentId: mappedId(componentMap, source.itemComponentId, "component"),
        items: source.items.map((item, index) => ({
          ...structuredClone(item),
          id: isLegacyId(item.id)
            ? allocateId("item", scope, `${source.id}:${item.id}:${index}`, usedItemIds)
            : item.id,
          componentId: mappedId(componentMap, item.componentId, "component"),
          props: remapPropAssets(item.props, assetMap),
        })),
      };
    } else {
      nodes[id] = { ...common, type: source.type } as DocumentNode;
    }
    if (!source.styleId) delete nodes[id].styleId;
    if (!source.archivedFrom) delete nodes[id].archivedFrom;
    if (source.type === "image" && !source.assetId && nodes[id].type === "image") {
      delete nodes[id].assetId;
    }
  });

  const components: Record<string, ComponentDefinition> = {};
  Object.values(document.components).forEach((source) => {
    const id = mappedId(componentMap, source.id, "component");
    components[id] = {
      ...structuredClone(source),
      id,
      rootNodeId: mappedId(nodeMap, source.rootNodeId, "node"),
      propDefinitions: source.propDefinitions.map((prop) => ({
        ...structuredClone(prop),
        binding: {
          ...prop.binding,
          nodeId: mappedId(nodeMap, prop.binding.nodeId, "node"),
        },
        defaultValue: remapValueAsset(prop.defaultValue, assetMap),
      })),
    };
  });

  const styles: Record<string, StyleDefinition> = {};
  Object.values(document.styles).forEach((source) => {
    const id = mappedId(styleMap, source.id, "style");
    styles[id] = { ...structuredClone(source), id };
  });
  const assets: Record<string, DocumentAsset> = {};
  Object.values(document.assets).forEach((source) => {
    const id = mappedId(assetMap, source.id, "asset");
    assets[id] = { ...structuredClone(source), id };
  });

  return {
    ...document,
    schemaVersion: 4,
    rootNodeId: mappedId(nodeMap, document.rootNodeId, "node"),
    nodes,
    components,
    styles,
    assets,
  };
}

export function rekeyLegacyComponentPackage(
  componentPackage: Omit<ComponentLibraryPackage, "schemaVersion"> & { schemaVersion: 1 | 2 },
  libraryItemId: string,
): ComponentLibraryPackage {
  const existingNodeIds = new Set(Object.keys(componentPackage.nodes));
  const allocateSyntheticNodeId = (base: string) => {
    let id = base;
    let suffix = 2;
    while (existingNodeIds.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    existingNodeIds.add(id);
    return id;
  };
  const syntheticRootId = allocateSyntheticNodeId("node-component-package-migration-root");
  const syntheticInstanceId = allocateSyntheticNodeId("node-component-package-migration-instance");
  const synthetic: DocumentData = {
    schemaVersion: 4,
    documentId: `component-library:${libraryItemId}`,
    name: componentPackage.name,
    rootNodeId: syntheticRootId,
    nodes: {
      [syntheticRootId]: {
        id: syntheticRootId,
        type: "container",
        name: "Component package migration root",
        visible: true,
        childIds: [syntheticInstanceId],
      },
      [syntheticInstanceId]: {
        id: syntheticInstanceId,
        type: "component-instance",
        name: "Component package migration instance",
        visible: true,
        componentId: componentPackage.entryComponentId,
        props: {},
      },
      ...structuredClone(componentPackage.nodes),
    },
    components: structuredClone(componentPackage.components),
    styles: structuredClone(componentPackage.styles),
    assets: structuredClone(componentPackage.assets),
    updatedAt: "1970-01-01T00:00:00.000Z",
  };
  const rekeyed = rekeyLegacyDocument(synthetic);
  assertDocumentData(rekeyed);
  const entryInstance = rekeyed.nodes[syntheticInstanceId];
  if (entryInstance?.type !== "component-instance") {
    throw new Error("component package entry를 변환하지 못했습니다.");
  }
  const entryComponentId = entryInstance.componentId;
  delete rekeyed.nodes[syntheticRootId];
  delete rekeyed.nodes[syntheticInstanceId];
  return {
    schemaVersion: 2,
    name: componentPackage.name,
    entryComponentId,
    components: rekeyed.components,
    nodes: rekeyed.nodes,
    styles: rekeyed.styles,
    assets: rekeyed.assets,
  };
}

export function createDeterministicEntityId(
  kind: "node" | "component" | "style" | "asset" | "item",
  scope: string,
  sourceId: string,
  attempt = 0,
): string {
  const bytes = createHash("sha1")
    .update("resume-studio:canonical-document:v1\0")
    .update(scope)
    .update("\0")
    .update(kind)
    .update("\0")
    .update(sourceId)
    .update("\0")
    .update(String(attempt))
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return `${kind}-${uuid}`;
}

function allocateRecordIds(
  sourceIds: string[],
  kind: "node" | "component" | "style" | "asset",
  scope: string,
): Map<string, string> {
  const used = new Set(sourceIds.filter((id) => !isLegacyId(id)));
  const result = new Map(sourceIds.filter(isLegacyId).sort().map((sourceId) => [
    sourceId,
    allocateId(kind, scope, sourceId, used),
  ]));
  sourceIds.filter((id) => !isLegacyId(id)).forEach((id) => result.set(id, id));
  return result;
}

function allocateId(
  kind: "node" | "component" | "style" | "asset" | "item",
  scope: string,
  sourceId: string,
  used: Set<string>,
): string {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const id = createDeterministicEntityId(kind, scope, sourceId, attempt);
    if (used.has(id)) continue;
    used.add(id);
    return id;
  }
  throw new Error(`${kind} ID 충돌을 해소하지 못했습니다.`);
}

function mappedId(map: Map<string, string>, id: string, kind: string): string {
  const mapped = map.get(id);
  if (!mapped) throw new Error(`${kind} 참조를 변환할 수 없습니다: ${id}`);
  return mapped;
}

function remapPropAssets(
  props: Record<string, ComponentPropValue>,
  assetMap: Map<string, string>,
): Record<string, ComponentPropValue> {
  return Object.fromEntries(Object.entries(props).map(([propId, value]) => [
    propId,
    remapValueAsset(value, assetMap),
  ]));
}

function remapValueAsset(
  value: ComponentPropValue,
  assetMap: Map<string, string>,
): ComponentPropValue {
  const copy = structuredClone(value);
  if (typeof copy !== "object" || !("alt" in copy) || !copy.assetId) return copy;
  return { ...copy, assetId: mappedId(assetMap, copy.assetId, "asset") };
}

function isLegacyId(id: string): boolean {
  return id.startsWith(LEGACY_ID_PREFIX);
}

function validationError(issues: Array<{ path: string; message: string }>): Error {
  const first = issues[0];
  return new Error(`${first?.path ?? "$"}: ${first?.message ?? "문서 형식이 올바르지 않습니다."}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
