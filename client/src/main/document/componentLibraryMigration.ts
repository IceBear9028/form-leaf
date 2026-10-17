import type {
  ComponentLibraryIndex,
  ComponentLibraryItem,
  ComponentLibrarySummary,
} from "../../foundation/componentLibrary.ts";
import { isComponentLibraryIndex, isComponentLibraryItem } from "../../foundation/componentLibrary.ts";
import type { ComponentLibraryPackage } from "../../foundation/documentComponentOperations.ts";
import { rekeyLegacyComponentPackage } from "./documentMigration.ts";

export function migrateComponentLibraryIndex(value: unknown): {
  index: ComponentLibraryIndex;
  migrated: boolean;
} {
  if (isComponentLibraryIndex(value)) return { index: value, migrated: false };
  if (!isRecord(value) || value.schemaVersion !== 1 || !isSummaryArray(value.items)) {
    throw new Error("컴포넌트 목록 형식이 올바르지 않습니다.");
  }
  return {
    index: { schemaVersion: 2, items: structuredClone(value.items) },
    migrated: true,
  };
}

export function migrateComponentLibraryItem(value: unknown): {
  item: ComponentLibraryItem;
  migrated: boolean;
} {
  if (!isLibraryItemShape(value)) throw new Error("컴포넌트 항목 형식이 올바르지 않습니다.");
  const packageValue = value.package;
  const needsRekey = packageValue.schemaVersion === 1 || hasLegacyPackageIds(packageValue);
  const item: ComponentLibraryItem = {
    schemaVersion: 2,
    id: value.id,
    name: value.name,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    package: needsRekey
      ? rekeyLegacyComponentPackage(packageValue, value.id)
      : structuredClone(packageValue) as ComponentLibraryPackage,
  };
  if (!isComponentLibraryItem(item)) throw new Error("컴포넌트 항목 형식이 올바르지 않습니다.");
  return {
    item,
    migrated: value.schemaVersion !== 2 || needsRekey,
  };
}

function isLibraryItemShape(value: unknown): value is {
  schemaVersion: 1 | 2;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  package: Omit<ComponentLibraryPackage, "schemaVersion"> & { schemaVersion: 1 | 2 };
} {
  return isRecord(value) &&
    (value.schemaVersion === 1 || value.schemaVersion === 2) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    isPackageShape(value.package);
}

function isPackageShape(value: unknown): value is Omit<ComponentLibraryPackage, "schemaVersion"> & { schemaVersion: 1 | 2 } {
  return isRecord(value) &&
    (value.schemaVersion === 1 || value.schemaVersion === 2) &&
    typeof value.name === "string" &&
    typeof value.entryComponentId === "string" &&
    isRecord(value.components) &&
    isRecord(value.nodes) &&
    isRecord(value.styles) &&
    isRecord(value.assets);
}

function hasLegacyPackageIds(componentPackage: Omit<ComponentLibraryPackage, "schemaVersion">): boolean {
  return [
    ...Object.keys(componentPackage.components),
    ...Object.keys(componentPackage.nodes),
    ...Object.keys(componentPackage.styles),
    ...Object.keys(componentPackage.assets),
    ...Object.values(componentPackage.nodes).flatMap((node) => (
      isRecord(node) && node.type === "repeater" && Array.isArray(node.items)
        ? node.items.flatMap((item) => isRecord(item) && typeof item.id === "string" ? [item.id] : [])
        : []
    )),
  ].some((id) => id.startsWith("legacy-"));
}

function isSummaryArray(value: unknown): value is ComponentLibrarySummary[] {
  return Array.isArray(value) && value.every((item) => (
    isRecord(item) &&
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  ));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
