import type {
  DocumentUpdate,
  DocumentUpdateOperation,
} from "../../../../../../foundation/documentUpdates.ts";
import type { PaginationUnit } from "../pagination.ts";
import type { RenderTreeNode } from "../renderTree.ts";

export type RenderImpact = "visual" | "layout" | "structure" | "global";

export type RenderDependencyIndex = {
  unitIdsByNodeId: ReadonlyMap<string, ReadonlySet<string>>;
  unitIdsByComponentId: ReadonlyMap<string, ReadonlySet<string>>;
  allUnitIds: ReadonlySet<string>;
};

export type RenderScope = {
  impact: RenderImpact;
  nodeIds: ReadonlySet<string>;
  layoutUnitIds: ReadonlySet<string>;
  earliestAffectedUnitId?: string;
  includesWholeTree: boolean;
  reasons: readonly string[];
};

export type RenderWorkPlan = {
  publishNodeIds: ReadonlySet<string>;
  invalidateMarkdownNodeIds: ReadonlySet<string>;
  measureUnitIdsAfterCommit: ReadonlySet<string>;
  repaginateFromUnitId?: string;
  rebuildWholeTree: boolean;
  reasons: readonly string[];
};

const visualStyleKeys = new Set([
  "decoration.background",
  "decoration.borderColor",
  "typography.color",
]);

const impactRank: Record<RenderImpact, number> = {
  visual: 0,
  layout: 1,
  structure: 2,
  global: 3,
};

export function buildRenderDependencyIndex(
  units: readonly PaginationUnit[],
): RenderDependencyIndex {
  const unitIdsByNodeId = new Map<string, Set<string>>();
  const unitIdsByComponentId = new Map<string, Set<string>>();
  const allUnitIds = new Set<string>();

  units.forEach((unit) => {
    allUnitIds.add(unit.id);
    visitRenderNode(unit.node, (node) => {
      addDependency(unitIdsByNodeId, node.sourceNodeId, unit.id);
      if (node.type === "component-instance" || node.type === "repeater") {
        addDependency(unitIdsByComponentId, node.componentId, unit.id);
      }
    });
  });

  return { unitIdsByNodeId, unitIdsByComponentId, allUnitIds };
}

export function resolveRenderScope(
  update: DocumentUpdate | undefined,
  index: RenderDependencyIndex,
  unitOrder: readonly string[],
): RenderScope {
  if (!update || update.operations.length === 0) return globalScope(index, "초기 또는 변경 정보 없음");

  const nodeIds = new Set<string>();
  const layoutUnitIds = new Set<string>();
  const reasons: string[] = [];
  let impact: RenderImpact = "visual";
  let includesWholeTree = false;

  update.operations.forEach((operation) => {
    const operationImpact = impactOf(operation);
    if (impactRank[operationImpact] > impactRank[impact]) impact = operationImpact;
    reasons.push(operation.type);

    if (operation.type === "document-replaced" || operation.type === "page-settings-updated") {
      includesWholeTree = true;
      index.allUnitIds.forEach((unitId) => layoutUnitIds.add(unitId));
      return;
    }
    if (operation.type === "component-definition-updated") {
      addAll(layoutUnitIds, index.unitIdsByComponentId.get(operation.componentId));
      return;
    }
    if (operation.type === "document-metadata-updated") return;

    nodeIds.add(operation.nodeId);
    addAll(layoutUnitIds, index.unitIdsByNodeId.get(operation.nodeId));
  });

  if (includesWholeTree) return globalScope(index, ...reasons);
  const earliestAffectedUnitId = unitOrder.find((unitId) => layoutUnitIds.has(unitId));
  return {
    impact,
    nodeIds,
    layoutUnitIds,
    earliestAffectedUnitId,
    includesWholeTree: false,
    reasons,
  };
}

export function createRenderWorkPlan(scope: RenderScope): RenderWorkPlan {
  const requiresLayout = scope.impact !== "visual";
  return {
    publishNodeIds: scope.nodeIds,
    invalidateMarkdownNodeIds: scope.nodeIds,
    measureUnitIdsAfterCommit: requiresLayout ? scope.layoutUnitIds : new Set(),
    repaginateFromUnitId: requiresLayout ? scope.earliestAffectedUnitId : undefined,
    rebuildWholeTree: scope.includesWholeTree || scope.impact === "structure" || scope.impact === "global",
    reasons: scope.reasons,
  };
}

export function mergeRenderWorkPlans(
  plans: readonly RenderWorkPlan[],
  unitOrder: readonly string[],
): RenderWorkPlan {
  const publishNodeIds = new Set<string>();
  const invalidateMarkdownNodeIds = new Set<string>();
  const measureUnitIdsAfterCommit = new Set<string>();
  const reasons = new Set<string>();
  let rebuildWholeTree = false;
  plans.forEach((plan) => {
    addAll(publishNodeIds, plan.publishNodeIds);
    addAll(invalidateMarkdownNodeIds, plan.invalidateMarkdownNodeIds);
    addAll(measureUnitIdsAfterCommit, plan.measureUnitIdsAfterCommit);
    plan.reasons.forEach((reason) => reasons.add(reason));
    rebuildWholeTree ||= plan.rebuildWholeTree;
  });
  const repaginateFromUnitId = unitOrder.find((unitId) => (
    plans.some((plan) => plan.repaginateFromUnitId === unitId)
  ));
  return {
    publishNodeIds,
    invalidateMarkdownNodeIds,
    measureUnitIdsAfterCommit,
    repaginateFromUnitId,
    rebuildWholeTree,
    reasons: [...reasons],
  };
}

function impactOf(operation: DocumentUpdateOperation): RenderImpact {
  if (operation.type === "document-replaced" || operation.type === "page-settings-updated") return "global";
  if (
    operation.type === "node-inserted" ||
    operation.type === "node-removed" ||
    operation.type === "node-moved" ||
    operation.type === "component-definition-updated"
  ) return "structure";
  if (operation.type === "document-metadata-updated") return "visual";
  if (operation.type === "node-style-updated") {
    return operation.styleKeys.length > 0 && operation.styleKeys.every((key) => visualStyleKeys.has(key))
      ? "visual"
      : "layout";
  }
  return "layout";
}

function globalScope(index: RenderDependencyIndex, ...reasons: string[]): RenderScope {
  return {
    impact: "global",
    nodeIds: new Set(index.unitIdsByNodeId.keys()),
    layoutUnitIds: new Set(index.allUnitIds),
    earliestAffectedUnitId: index.allUnitIds.values().next().value,
    includesWholeTree: true,
    reasons,
  };
}

function visitRenderNode(node: RenderTreeNode, visit: (node: RenderTreeNode) => void): void {
  visit(node);
  if (node.type === "container") node.children.forEach((child) => visitRenderNode(child, visit));
  else if (node.type === "component-instance") visitRenderNode(node.child, visit);
  else if (node.type === "repeater") node.items.forEach((item) => visitRenderNode(item.child, visit));
}

function addDependency(map: Map<string, Set<string>>, key: string, unitId: string): void {
  const values = map.get(key) ?? new Set<string>();
  values.add(unitId);
  map.set(key, values);
}

function addAll<T>(target: Set<T>, values: Iterable<T> | undefined): void {
  if (!values) return;
  for (const value of values) target.add(value);
}
