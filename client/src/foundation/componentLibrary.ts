import type { ComponentLibraryPackage } from "./documentComponentOperations.ts";

export const COMPONENT_LIBRARY_SCHEMA_VERSION = 2 as const;

export type ComponentLibrarySummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type ComponentLibraryItem = ComponentLibrarySummary & {
  schemaVersion: typeof COMPONENT_LIBRARY_SCHEMA_VERSION;
  package: ComponentLibraryPackage;
};

export type ComponentLibraryPackageInput = {
  id?: string;
  name: string;
  package: ComponentLibraryPackage;
};

export type ComponentLibraryIndex = {
  schemaVersion: typeof COMPONENT_LIBRARY_SCHEMA_VERSION;
  items: ComponentLibrarySummary[];
};

export function createEmptyComponentLibraryIndex(): ComponentLibraryIndex {
  return { schemaVersion: COMPONENT_LIBRARY_SCHEMA_VERSION, items: [] };
}

export function sortComponentSummaries(items: ComponentLibrarySummary[]): ComponentLibrarySummary[] {
  return [...items].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt) ||
    left.id.localeCompare(right.id),
  );
}

export function isComponentLibraryIndex(value: unknown): value is ComponentLibraryIndex {
  return isRecord(value) &&
    value.schemaVersion === COMPONENT_LIBRARY_SCHEMA_VERSION &&
    Array.isArray(value.items) && value.items.every(isComponentLibrarySummary);
}

export function isComponentLibraryItem(value: unknown): value is ComponentLibraryItem {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    value.schemaVersion === COMPONENT_LIBRARY_SCHEMA_VERSION &&
    isComponentLibraryPackage(value.package);
}

function isComponentLibrarySummary(value: unknown): value is ComponentLibrarySummary {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string";
}

function isComponentLibraryPackage(value: unknown): value is ComponentLibraryPackage {
  return isRecord(value) &&
    value.schemaVersion === 2 &&
    typeof value.name === "string" &&
    typeof value.entryComponentId === "string" &&
    isRecord(value.components) &&
    isRecord(value.nodes) &&
    isRecord(value.styles) &&
    isRecord(value.assets) &&
    !hasLegacyPackageIds(value);
}

function hasLegacyPackageIds(value: Record<string, unknown>): boolean {
  const components = value.components as Record<string, unknown>;
  const nodes = value.nodes as Record<string, unknown>;
  const styles = value.styles as Record<string, unknown>;
  const assets = value.assets as Record<string, unknown>;
  return [
    ...Object.keys(components),
    ...Object.keys(nodes),
    ...Object.keys(styles),
    ...Object.keys(assets),
    ...Object.values(nodes).flatMap((node) => (
      isRecord(node) && node.type === "repeater" && Array.isArray(node.items)
        ? node.items.flatMap((item) => isRecord(item) && typeof item.id === "string" ? [item.id] : [])
        : []
    )),
  ].some((id) => id.startsWith("legacy-"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
