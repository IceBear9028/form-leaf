import type {
  ColorValue,
  ComponentDefinition,
  ComponentInstanceValue,
  ComponentPropDefinition,
  ComponentPropValue,
  ComponentPropValueType,
  DocumentAsset,
  DocumentData,
  DocumentNode,
  ImageValue,
  RichTextMark,
  RichTextValue,
  StyleDefinition,
} from "./documentModel.ts";
import { DOCUMENT_SCHEMA_VERSION } from "./documentModel.ts";

export type DocumentValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type DocumentValidationResult =
  | { valid: true; document: DocumentData; issues: [] }
  | { valid: false; issues: DocumentValidationIssue[] };

type IssueWriter = (code: string, path: string, message: string) => void;

export function validateDocumentData(value: unknown): DocumentValidationResult {
  const issues: DocumentValidationIssue[] = [];
  const issue: IssueWriter = (code, path, message) => {
    issues.push({ code, path, message });
  };

  if (!isRecord(value)) {
    issue("document.type", "$", "문서는 객체여야 합니다.");
    return { valid: false, issues };
  }

  rejectUnknownKeys(
    value,
    ["schemaVersion", "documentId", "name", "rootNodeId", "nodes", "components", "styles", "assets", "updatedAt"],
    "$",
    issue,
  );

  if (value.schemaVersion !== DOCUMENT_SCHEMA_VERSION) {
    issue("document.schema-version", "$.schemaVersion", `schemaVersion은 ${DOCUMENT_SCHEMA_VERSION}이어야 합니다.`);
  }
  requireNonEmptyString(value.documentId, "$.documentId", issue);
  requireString(value.name, "$.name", issue);
  requireNonEmptyString(value.rootNodeId, "$.rootNodeId", issue);
  requireIsoDate(value.updatedAt, "$.updatedAt", issue);

  const nodes = validateRecordEntries<DocumentNode>(
    value.nodes,
    "$.nodes",
    issue,
    validateNode,
  );
  const components = validateRecordEntries<ComponentDefinition>(
    value.components,
    "$.components",
    issue,
    validateComponent,
  );
  const styles = validateRecordEntries<StyleDefinition>(
    value.styles,
    "$.styles",
    issue,
    validateStyle,
  );
  const assets = validateRecordEntries<DocumentAsset>(
    value.assets,
    "$.assets",
    issue,
    validateAsset,
  );

  if (
    typeof value.rootNodeId === "string" &&
    nodes && components && styles && assets
  ) {
    validateRelations(value.rootNodeId, nodes, components, styles, assets, issue);
  }

  if (issues.length) return { valid: false, issues };
  return { valid: true, document: value as DocumentData, issues: [] };
}

export function isDocumentData(value: unknown): value is DocumentData {
  return validateDocumentData(value).valid;
}

export function assertDocumentData(value: unknown): asserts value is DocumentData {
  const result = validateDocumentData(value);
  if (result.valid) return;
  const first = result.issues[0];
  throw new Error(`${first?.path ?? "$"}: ${first?.message ?? "문서 형식이 올바르지 않습니다."}`);
}

function validateRecordEntries<T>(
  value: unknown,
  path: string,
  issue: IssueWriter,
  validateEntry: (value: unknown, path: string, issue: IssueWriter) => value is T,
): Record<string, T> | undefined {
  if (!isRecord(value)) {
    issue("record.type", path, "ID를 key로 사용하는 객체여야 합니다.");
    return undefined;
  }
  const validEntries: Record<string, T> = {};
  Object.entries(value).forEach(([key, entry]) => {
    const entryPath = `${path}.${key}`;
    if (!validateEntry(entry, entryPath, issue)) return;
    if ((entry as { id: string }).id !== key) {
      issue("record.id-mismatch", `${entryPath}.id`, "객체 key와 내부 ID가 일치해야 합니다.");
      return;
    }
    validEntries[key] = entry;
  });
  return validEntries;
}

function validateNode(value: unknown, path: string, issue: IssueWriter): value is DocumentNode {
  if (!isRecord(value)) {
    issue("node.type", path, "node는 객체여야 합니다.");
    return false;
  }
  let valid = true;
  const commonKeys = ["id", "type", "name", "visible", "styleId", "archivedFrom"];
  valid = requireNonEmptyString(value.id, `${path}.id`, issue) && valid;
  valid = requireString(value.name, `${path}.name`, issue) && valid;
  valid = requireBoolean(value.visible, `${path}.visible`, issue) && valid;
  if (value.styleId !== undefined) {
    valid = requireNonEmptyString(value.styleId, `${path}.styleId`, issue) && valid;
  }
  if (value.archivedFrom !== undefined) {
    if (!isRecord(value.archivedFrom)) {
      issue("node.archive", `${path}.archivedFrom`, "보관 위치는 객체여야 합니다.");
      valid = false;
    } else {
      rejectUnknownKeys(value.archivedFrom, ["parentId", "index"], `${path}.archivedFrom`, issue);
      valid = requireNonEmptyString(value.archivedFrom.parentId, `${path}.archivedFrom.parentId`, issue) && valid;
      valid = requireNonNegativeInteger(value.archivedFrom.index, `${path}.archivedFrom.index`, issue) && valid;
    }
  }

  if (value.type === "container") {
    rejectUnknownKeys(value, [...commonKeys, "childIds"], path, issue);
    valid = requireStringArray(value.childIds, `${path}.childIds`, issue) && valid;
  } else if (value.type === "text") {
    rejectUnknownKeys(value, [...commonKeys, "value"], path, issue);
    valid = requireString(value.value, `${path}.value`, issue) && valid;
  } else if (value.type === "rich-text") {
    rejectUnknownKeys(value, [...commonKeys, "value"], path, issue);
    valid = validateRichText(value.value, `${path}.value`, issue) && valid;
  } else if (value.type === "markdown") {
    rejectUnknownKeys(value, [...commonKeys, "source"], path, issue);
    valid = requireString(value.source, `${path}.source`, issue) && valid;
  } else if (value.type === "image") {
    rejectUnknownKeys(value, [...commonKeys, "assetId", "alt"], path, issue);
    valid = validateImageValue(value, path, issue, true) && valid;
  } else if (value.type === "repeater") {
    rejectUnknownKeys(value, [...commonKeys, "itemComponentId", "items"], path, issue);
    valid = requireNonEmptyString(value.itemComponentId, `${path}.itemComponentId`, issue) && valid;
    if (!Array.isArray(value.items)) {
      issue("repeater.items", `${path}.items`, "반복 항목은 배열이어야 합니다.");
      valid = false;
    } else {
      value.items.forEach((item, index) => {
        valid = validateComponentInstanceValue(item, `${path}.items.${index}`, issue) && valid;
      });
    }
  } else if (value.type === "component-instance") {
    rejectUnknownKeys(value, [...commonKeys, "componentId", "props"], path, issue);
    valid = requireNonEmptyString(value.componentId, `${path}.componentId`, issue) && valid;
    valid = validatePropRecord(value.props, `${path}.props`, issue) && valid;
  } else {
    issue("node.unknown-type", `${path}.type`, "지원하지 않는 node type입니다.");
    valid = false;
  }
  return valid;
}

function validateComponent(
  value: unknown,
  path: string,
  issue: IssueWriter,
): value is ComponentDefinition {
  if (!isRecord(value)) {
    issue("component.type", path, "component는 객체여야 합니다.");
    return false;
  }
  let valid = true;
  rejectUnknownKeys(value, ["id", "name", "rootNodeId", "propDefinitions"], path, issue);
  valid = requireNonEmptyString(value.id, `${path}.id`, issue) && valid;
  valid = requireString(value.name, `${path}.name`, issue) && valid;
  valid = requireNonEmptyString(value.rootNodeId, `${path}.rootNodeId`, issue) && valid;
  if (!Array.isArray(value.propDefinitions)) {
    issue("component.props", `${path}.propDefinitions`, "propDefinitions는 배열이어야 합니다.");
    valid = false;
  } else {
    value.propDefinitions.forEach((prop, index) => {
      valid = validatePropDefinition(prop, `${path}.propDefinitions.${index}`, issue) && valid;
    });
  }
  return valid;
}

function validatePropDefinition(
  value: unknown,
  path: string,
  issue: IssueWriter,
): value is ComponentPropDefinition {
  if (!isRecord(value)) {
    issue("component.prop.type", path, "prop definition은 객체여야 합니다.");
    return false;
  }
  let valid = true;
  rejectUnknownKeys(value, ["id", "name", "status", "valueType", "binding", "defaultValue"], path, issue);
  valid = requireNonEmptyString(value.id, `${path}.id`, issue) && valid;
  valid = requireString(value.name, `${path}.name`, issue) && valid;
  if (value.status !== "active" && value.status !== "archived") {
    issue("component.prop.status", `${path}.status`, "prop 상태가 올바르지 않습니다.");
    valid = false;
  }
  if (!isPropValueType(value.valueType)) {
    issue("component.prop.value-type", `${path}.valueType`, "prop value type이 올바르지 않습니다.");
    valid = false;
  }
  if (!isRecord(value.binding)) {
    issue("component.prop.binding", `${path}.binding`, "prop binding은 객체여야 합니다.");
    valid = false;
  } else {
    rejectUnknownKeys(value.binding, ["nodeId", "property"], `${path}.binding`, issue);
    valid = requireNonEmptyString(value.binding.nodeId, `${path}.binding.nodeId`, issue) && valid;
    if (!isBindingProperty(value.binding.property)) {
      issue("component.prop.binding-property", `${path}.binding.property`, "binding property가 올바르지 않습니다.");
      valid = false;
    }
  }
  if (isPropValueType(value.valueType)) {
    valid = validatePropValue(value.defaultValue, value.valueType, `${path}.defaultValue`, issue) && valid;
  }
  return valid;
}

function validateStyle(value: unknown, path: string, issue: IssueWriter): value is StyleDefinition {
  if (!isRecord(value)) {
    issue("style.type", path, "style은 객체여야 합니다.");
    return false;
  }
  let valid = true;
  rejectUnknownKeys(value, ["id", "name", "layout", "typography", "markdown", "decoration", "pagination"], path, issue);
  valid = requireNonEmptyString(value.id, `${path}.id`, issue) && valid;
  valid = requireString(value.name, `${path}.name`, issue) && valid;
  if (value.layout !== undefined) {
    if (!isRecord(value.layout)) {
      issue("style.layout", `${path}.layout`, "layout은 객체여야 합니다.");
      valid = false;
    } else {
      const layout = value.layout;
      rejectUnknownKeys(layout, ["direction", "gapPt", "paddingPt", "align", "justify", "width", "heightPt", "grow"], `${path}.layout`, issue);
      if (layout.direction !== undefined && layout.direction !== "row" && layout.direction !== "column") {
        issue("style.layout.direction", `${path}.layout.direction`, "direction은 row 또는 column이어야 합니다.");
        valid = false;
      }
      if (layout.gapPt !== undefined) valid = requireNonNegativeNumber(layout.gapPt, `${path}.layout.gapPt`, issue) && valid;
      if (layout.paddingPt !== undefined) {
        if (!Array.isArray(layout.paddingPt) || layout.paddingPt.length !== 4 || !layout.paddingPt.every(isNonNegativeNumber)) {
          issue("style.layout.padding", `${path}.layout.paddingPt`, "padding은 음수가 아닌 네 개의 pt 값이어야 합니다.");
          valid = false;
        }
      }
      if (layout.align !== undefined && !["start", "center", "end", "stretch"].includes(String(layout.align))) {
        issue("style.layout.align", `${path}.layout.align`, "align 값이 올바르지 않습니다.");
        valid = false;
      }
      if (layout.justify !== undefined && !["start", "center", "end", "between"].includes(String(layout.justify))) {
        issue("style.layout.justify", `${path}.layout.justify`, "justify 값이 올바르지 않습니다.");
        valid = false;
      }
      if (layout.width !== undefined) valid = validateWidth(layout.width, `${path}.layout.width`, issue) && valid;
      if (layout.heightPt !== undefined) valid = requirePositiveNumber(layout.heightPt, `${path}.layout.heightPt`, issue) && valid;
      if (layout.grow !== undefined) valid = requireNonNegativeNumber(layout.grow, `${path}.layout.grow`, issue) && valid;
    }
  }
  if (value.typography !== undefined) {
    if (!isRecord(value.typography)) {
      issue("style.typography", `${path}.typography`, "typography는 객체여야 합니다.");
      valid = false;
    } else {
      const typography = value.typography;
      rejectUnknownKeys(typography, ["fontFamily", "fontSizePt", "lineHeight", "fontWeight", "color"], `${path}.typography`, issue);
      if (typography.fontFamily !== undefined) valid = requireNonEmptyString(typography.fontFamily, `${path}.typography.fontFamily`, issue) && valid;
      if (typography.fontSizePt !== undefined) valid = requirePositiveNumber(typography.fontSizePt, `${path}.typography.fontSizePt`, issue) && valid;
      if (typography.lineHeight !== undefined) valid = requirePositiveNumber(typography.lineHeight, `${path}.typography.lineHeight`, issue) && valid;
      if (typography.fontWeight !== undefined) {
        if (!isFiniteNumber(typography.fontWeight) || typography.fontWeight < 100 || typography.fontWeight > 1000) {
          issue("style.typography.weight", `${path}.typography.fontWeight`, "fontWeight는 100 이상 1000 이하여야 합니다.");
          valid = false;
        }
      }
      if (typography.color !== undefined) valid = validateColor(typography.color, `${path}.typography.color`, issue) && valid;
    }
  }
  if (value.markdown !== undefined) {
    if (!isRecord(value.markdown)) {
      issue("style.markdown", `${path}.markdown`, "markdown은 객체여야 합니다.");
      valid = false;
    } else {
      const markdown = value.markdown;
      rejectUnknownKeys(markdown, ["listItemGapPt"], `${path}.markdown`, issue);
      if (markdown.listItemGapPt !== undefined) {
        valid = requireNonNegativeNumber(markdown.listItemGapPt, `${path}.markdown.listItemGapPt`, issue) && valid;
      }
    }
  }
  if (value.decoration !== undefined) {
    if (!isRecord(value.decoration)) {
      issue("style.decoration", `${path}.decoration`, "decoration은 객체여야 합니다.");
      valid = false;
    } else {
      const decoration = value.decoration;
      rejectUnknownKeys(decoration, ["background", "borderColor", "borderWidthPt", "borderEdges", "radiusPt"], `${path}.decoration`, issue);
      if (decoration.background !== undefined) valid = validateColor(decoration.background, `${path}.decoration.background`, issue) && valid;
      if (decoration.borderColor !== undefined) valid = validateColor(decoration.borderColor, `${path}.decoration.borderColor`, issue) && valid;
      if (decoration.borderWidthPt !== undefined) valid = requireNonNegativeNumber(decoration.borderWidthPt, `${path}.decoration.borderWidthPt`, issue) && valid;
      if (decoration.borderEdges !== undefined) {
        const allowedEdges = ["top", "right", "bottom", "left"];
        if (!Array.isArray(decoration.borderEdges) ||
          !decoration.borderEdges.every((edge) => allowedEdges.includes(String(edge))) ||
          new Set(decoration.borderEdges).size !== decoration.borderEdges.length) {
          issue("style.decoration.border-edges", `${path}.decoration.borderEdges`, "borderEdges는 중복 없는 border 방향 배열이어야 합니다.");
          valid = false;
        }
      }
      if (decoration.radiusPt !== undefined) valid = requireNonNegativeNumber(decoration.radiusPt, `${path}.decoration.radiusPt`, issue) && valid;
    }
  }
  if (value.pagination !== undefined) {
    if (!isRecord(value.pagination)) {
      issue("style.pagination", `${path}.pagination`, "pagination은 객체여야 합니다.");
      valid = false;
    } else {
      const pagination = value.pagination;
      rejectUnknownKeys(pagination, ["keepTogether", "keepWithNext", "forcePageBreakBefore"], `${path}.pagination`, issue);
      ["keepTogether", "keepWithNext", "forcePageBreakBefore"].forEach((key) => {
        const entry = pagination[key];
        if (entry !== undefined) valid = requireBoolean(entry, `${path}.pagination.${key}`, issue) && valid;
      });
    }
  }
  return valid;
}

function validateAsset(value: unknown, path: string, issue: IssueWriter): value is DocumentAsset {
  if (!isRecord(value)) {
    issue("asset.type", path, "asset은 객체여야 합니다.");
    return false;
  }
  let valid = true;
  rejectUnknownKeys(value, ["id", "type", "name", "mimeType", "dataUrl"], path, issue);
  valid = requireNonEmptyString(value.id, `${path}.id`, issue) && valid;
  valid = requireString(value.name, `${path}.name`, issue) && valid;
  if (value.type !== "image") {
    issue("asset.kind", `${path}.type`, "지원하지 않는 asset type입니다.");
    valid = false;
  }
  const mimeTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  if (typeof value.mimeType !== "string" || !mimeTypes.includes(value.mimeType)) {
    issue("asset.mime", `${path}.mimeType`, "지원하지 않는 이미지 MIME type입니다.");
    valid = false;
  }
  if (typeof value.dataUrl !== "string" || !/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(value.dataUrl)) {
    issue("asset.data-url", `${path}.dataUrl`, "이미지는 허용된 data URL이어야 합니다.");
    valid = false;
  }
  return valid;
}

function validateRelations(
  rootNodeId: string,
  nodes: Record<string, DocumentNode>,
  components: Record<string, ComponentDefinition>,
  styles: Record<string, StyleDefinition>,
  assets: Record<string, DocumentAsset>,
  issue: IssueWriter,
): void {
  const root = nodes[rootNodeId];
  if (!root) {
    issue("document.root-missing", "$.rootNodeId", "root node를 찾을 수 없습니다.");
  } else if (root.type !== "container") {
    issue("document.root-type", "$.rootNodeId", "root node는 container여야 합니다.");
  } else if (root.archivedFrom) {
    issue("document.root-archived", "$.rootNodeId", "root node는 보관할 수 없습니다.");
  }

  const parentCounts = new Map<string, number>();
  Object.values(nodes).forEach((node) => {
    if (node.styleId && !styles[node.styleId]) {
      issue("node.style-missing", `$.nodes.${node.id}.styleId`, "참조한 style을 찾을 수 없습니다.");
    }
    if (node.type === "image" && node.assetId && !assets[node.assetId]) {
      issue("node.asset-missing", `$.nodes.${node.id}.assetId`, "참조한 asset을 찾을 수 없습니다.");
    }
    if (node.type !== "container") return;
    const uniqueChildren = new Set<string>();
    node.childIds.forEach((childId, index) => {
      if (uniqueChildren.has(childId)) {
        issue("node.child-duplicate", `$.nodes.${node.id}.childIds.${index}`, "같은 child를 두 번 참조할 수 없습니다.");
      }
      uniqueChildren.add(childId);
      if (!nodes[childId]) {
        issue("node.child-missing", `$.nodes.${node.id}.childIds.${index}`, "참조한 child node를 찾을 수 없습니다.");
        return;
      }
      parentCounts.set(childId, (parentCounts.get(childId) ?? 0) + 1);
    });
  });

  detectNodeCycles(nodes, issue);

  const componentRootIds = new Set<string>();
  Object.values(components).forEach((component) => {
    if (!nodes[component.rootNodeId]) {
      issue("component.root-missing", `$.components.${component.id}.rootNodeId`, "component root node를 찾을 수 없습니다.");
      return;
    }
    if (componentRootIds.has(component.rootNodeId) || component.rootNodeId === rootNodeId) {
      issue("component.root-shared", `$.components.${component.id}.rootNodeId`, "root node는 하나의 document 또는 component만 소유할 수 있습니다.");
    }
    componentRootIds.add(component.rootNodeId);
    const propIds = new Set<string>();
    const bindingTargets = new Set<string>();
    const subtree = collectStructuralSubtree(component.rootNodeId, nodes);
    component.propDefinitions.forEach((prop, index) => {
      const propPath = `$.components.${component.id}.propDefinitions.${index}`;
      if (propIds.has(prop.id)) {
        issue("component.prop.duplicate", `${propPath}.id`, "component 안에서 prop ID는 고유해야 합니다.");
      }
      propIds.add(prop.id);
      const bindingTarget = `${prop.binding.nodeId}:${prop.binding.property}`;
      if (bindingTargets.has(bindingTarget)) {
        issue("component.prop.binding-duplicate", `${propPath}.binding`, "하나의 node property에는 하나의 prop만 연결할 수 있습니다.");
      }
      bindingTargets.add(bindingTarget);
      if (!subtree.has(prop.binding.nodeId)) {
        issue("component.prop.outside-root", `${propPath}.binding.nodeId`, "binding target은 component subtree 안에 있어야 합니다.");
      } else {
        validateBindingTarget(prop, nodes[prop.binding.nodeId], propPath, issue);
      }
      validateAssetReferencesInValue(prop.defaultValue, `${propPath}.defaultValue`, assets, issue);
    });
  });

  const anchorIds = new Set<string>([rootNodeId, ...componentRootIds]);
  Object.values(nodes).forEach((node) => {
    const parentCount = parentCounts.get(node.id) ?? 0;
    if (node.archivedFrom) {
      anchorIds.add(node.id);
      if (parentCount > 0) {
        issue("node.archived-attached", `$.nodes.${node.id}.archivedFrom`, "보관된 node는 container child로 남을 수 없습니다.");
      }
      const parent = nodes[node.archivedFrom.parentId];
      if (!parent || parent.type !== "container") {
        issue("node.archive-parent", `$.nodes.${node.id}.archivedFrom.parentId`, "복원 대상은 존재하는 container여야 합니다.");
      }
      if (collectStructuralSubtree(node.id, nodes).has(node.archivedFrom.parentId)) {
        issue("node.archive-cycle", `$.nodes.${node.id}.archivedFrom.parentId`, "자기 subtree 안으로 복원할 수 없습니다.");
      }
    } else if (anchorIds.has(node.id)) {
      if (parentCount > 0) {
        issue("node.root-attached", `$.nodes.${node.id}`, "document와 component root는 다른 container의 child가 될 수 없습니다.");
      }
    } else if (parentCount !== 1) {
      issue(
        parentCount > 1 ? "node.multiple-parents" : "node.orphan",
        `$.nodes.${node.id}`,
        parentCount > 1 ? "node는 둘 이상의 container가 소유할 수 없습니다." : "소유자나 보관 위치가 없는 node입니다.",
      );
    }
  });

  const reachable = new Set<string>();
  anchorIds.forEach((anchorId) => {
    collectStructuralSubtree(anchorId, nodes).forEach((nodeId) => reachable.add(nodeId));
  });
  Object.keys(nodes).forEach((nodeId) => {
    if (!reachable.has(nodeId)) issue("node.unreachable", `$.nodes.${nodeId}`, "어떤 root에서도 도달할 수 없는 node입니다.");
  });

  Object.values(nodes).forEach((node) => {
    if (node.type === "component-instance") {
      validateInstanceReference(node.componentId, node.props, `$.nodes.${node.id}`, components, assets, issue);
    }
    if (node.type === "repeater") {
      if (!components[node.itemComponentId]) {
        issue("repeater.component-missing", `$.nodes.${node.id}.itemComponentId`, "반복할 component를 찾을 수 없습니다.");
      }
      const itemIds = new Set<string>();
      node.items.forEach((item, index) => {
        const itemPath = `$.nodes.${node.id}.items.${index}`;
        if (itemIds.has(item.id)) issue("repeater.item-duplicate", `${itemPath}.id`, "repeater item ID는 고유해야 합니다.");
        itemIds.add(item.id);
        if (item.componentId !== node.itemComponentId) {
          issue("repeater.item-component", `${itemPath}.componentId`, "item component가 repeater 정의와 일치해야 합니다.");
        }
        validateInstanceReference(item.componentId, item.props, itemPath, components, assets, issue);
      });
    }
  });

  detectComponentCycles(components, nodes, issue);
}

function detectNodeCycles(nodes: Record<string, DocumentNode>, issue: IssueWriter): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (nodeId: string) => {
    if (visiting.has(nodeId)) {
      issue("node.cycle", `$.nodes.${nodeId}`, "node graph에 순환 참조가 있습니다.");
      return;
    }
    if (visited.has(nodeId)) return;
    visiting.add(nodeId);
    const node = nodes[nodeId];
    if (node?.type === "container") node.childIds.forEach(visit);
    visiting.delete(nodeId);
    visited.add(nodeId);
  };
  Object.keys(nodes).forEach(visit);
}

function detectComponentCycles(
  components: Record<string, ComponentDefinition>,
  nodes: Record<string, DocumentNode>,
  issue: IssueWriter,
): void {
  const references = new Map<string, Set<string>>();
  Object.values(components).forEach((component) => {
    const targets = new Set<string>();
    collectStructuralSubtree(component.rootNodeId, nodes).forEach((nodeId) => {
      const node = nodes[nodeId];
      if (node?.type === "component-instance") targets.add(node.componentId);
      if (node?.type === "repeater") targets.add(node.itemComponentId);
    });
    references.set(component.id, targets);
  });
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (componentId: string) => {
    if (visiting.has(componentId)) {
      issue("component.cycle", `$.components.${componentId}`, "component graph에 순환 참조가 있습니다.");
      return;
    }
    if (visited.has(componentId)) return;
    visiting.add(componentId);
    references.get(componentId)?.forEach((targetId) => {
      if (components[targetId]) visit(targetId);
    });
    visiting.delete(componentId);
    visited.add(componentId);
  };
  Object.keys(components).forEach(visit);
}

function collectStructuralSubtree(
  rootNodeId: string,
  nodes: Record<string, DocumentNode>,
): Set<string> {
  const result = new Set<string>();
  const visit = (nodeId: string) => {
    if (result.has(nodeId)) return;
    result.add(nodeId);
    const node = nodes[nodeId];
    if (node?.type === "container") node.childIds.forEach(visit);
  };
  if (nodes[rootNodeId]) visit(rootNodeId);
  return result;
}

function validateBindingTarget(
  prop: ComponentPropDefinition,
  node: DocumentNode | undefined,
  path: string,
  issue: IssueWriter,
): void {
  const expected: Record<ComponentPropDefinition["binding"]["property"], [DocumentNode["type"], ComponentPropValueType]> = {
    "text.value": ["text", "text"],
    "rich-text.value": ["rich-text", "rich-text"],
    "markdown.source": ["markdown", "markdown"],
    "image.value": ["image", "image"],
  };
  const [nodeType, valueType] = expected[prop.binding.property];
  if (!node || node.type !== nodeType) {
    issue("component.prop.binding-node", `${path}.binding`, "binding property와 target node type이 일치하지 않습니다.");
  }
  if (prop.valueType !== valueType) {
    issue("component.prop.binding-value", `${path}.valueType`, "binding property와 prop value type이 일치하지 않습니다.");
  }
}

function validateInstanceReference(
  componentId: string,
  props: Record<string, ComponentPropValue>,
  path: string,
  components: Record<string, ComponentDefinition>,
  assets: Record<string, DocumentAsset>,
  issue: IssueWriter,
): void {
  const component = components[componentId];
  if (!component) {
    issue("instance.component-missing", `${path}.componentId`, "참조한 component를 찾을 수 없습니다.");
    return;
  }
  const definitions = new Map(component.propDefinitions.map((prop) => [prop.id, prop]));
  Object.entries(props).forEach(([propId, value]) => {
    const definition = definitions.get(propId);
    if (!definition) {
      issue("instance.prop-unknown", `${path}.props.${propId}`, "component에 정의되지 않은 prop입니다.");
      return;
    }
    validatePropValue(value, definition.valueType, `${path}.props.${propId}`, issue);
    validateAssetReferencesInValue(value, `${path}.props.${propId}`, assets, issue);
  });
}

function validateComponentInstanceValue(
  value: unknown,
  path: string,
  issue: IssueWriter,
): value is ComponentInstanceValue {
  if (!isRecord(value)) {
    issue("instance.type", path, "component instance는 객체여야 합니다.");
    return false;
  }
  let valid = true;
  rejectUnknownKeys(value, ["id", "componentId", "visible", "props"], path, issue);
  valid = requireNonEmptyString(value.id, `${path}.id`, issue) && valid;
  valid = requireNonEmptyString(value.componentId, `${path}.componentId`, issue) && valid;
  valid = requireBoolean(value.visible, `${path}.visible`, issue) && valid;
  valid = validatePropRecord(value.props, `${path}.props`, issue) && valid;
  return valid;
}

function validatePropRecord(value: unknown, path: string, issue: IssueWriter): value is Record<string, ComponentPropValue> {
  if (!isRecord(value)) {
    issue("instance.props", path, "props는 객체여야 합니다.");
    return false;
  }
  let valid = true;
  Object.entries(value).forEach(([key, entry]) => {
    if (!key) {
      issue("instance.prop-id", path, "prop ID는 비어 있을 수 없습니다.");
      valid = false;
    }
    if (!isPotentialPropValue(entry)) {
      issue("instance.prop-value", `${path}.${key}`, "지원하지 않는 prop 값입니다.");
      valid = false;
    }
  });
  return valid;
}

function validatePropValue(
  value: unknown,
  valueType: ComponentPropValueType,
  path: string,
  issue: IssueWriter,
): boolean {
  if (valueType === "text" || valueType === "markdown") return requireString(value, path, issue);
  if (valueType === "number") {
    if (isFiniteNumber(value)) return true;
    issue("prop.number", path, "숫자 값이어야 합니다.");
    return false;
  }
  if (valueType === "boolean") return requireBoolean(value, path, issue);
  if (valueType === "rich-text") return validateRichText(value, path, issue);
  return validateImageValue(value, path, issue);
}

function isPotentialPropValue(value: unknown): value is ComponentPropValue {
  if (typeof value === "string" || typeof value === "boolean" || isFiniteNumber(value)) return true;
  if (!isRecord(value)) return false;
  if (Array.isArray(value.runs)) return true;
  return typeof value.alt === "string" && (value.assetId === undefined || typeof value.assetId === "string");
}

function validateRichText(value: unknown, path: string, issue: IssueWriter): value is RichTextValue {
  if (!isRecord(value) || !Array.isArray(value.runs)) {
    issue("rich-text.value", path, "rich-text 값에는 runs 배열이 필요합니다.");
    return false;
  }
  rejectUnknownKeys(value, ["runs"], path, issue);
  let valid = true;
  value.runs.forEach((run, runIndex) => {
    const runPath = `${path}.runs.${runIndex}`;
    if (!isRecord(run)) {
      issue("rich-text.run", runPath, "run은 객체여야 합니다.");
      valid = false;
      return;
    }
    rejectUnknownKeys(run, ["text", "marks"], runPath, issue);
    valid = requireString(run.text, `${runPath}.text`, issue) && valid;
    if (run.marks !== undefined) {
      if (!Array.isArray(run.marks)) {
        issue("rich-text.marks", `${runPath}.marks`, "marks는 배열이어야 합니다.");
        valid = false;
      } else {
        const markTypes = new Set<string>();
        run.marks.forEach((mark, markIndex) => {
          const markPath = `${runPath}.marks.${markIndex}`;
          if (!validateMark(mark, markPath, issue)) valid = false;
          if (isRecord(mark) && typeof mark.type === "string") {
            if (markTypes.has(mark.type)) {
              issue("rich-text.mark-duplicate", markPath, "한 run에 같은 mark를 중복 적용할 수 없습니다.");
              valid = false;
            }
            markTypes.add(mark.type);
          }
        });
      }
    }
  });
  return valid;
}

function validateMark(value: unknown, path: string, issue: IssueWriter): value is RichTextMark {
  if (!isRecord(value) || typeof value.type !== "string") {
    issue("rich-text.mark", path, "mark는 type을 가진 객체여야 합니다.");
    return false;
  }
  if (["bold", "italic", "underline", "strike"].includes(value.type)) {
    rejectUnknownKeys(value, ["type"], path, issue);
    return true;
  }
  if (value.type === "link") {
    rejectUnknownKeys(value, ["type", "href"], path, issue);
    return requireNonEmptyString(value.href, `${path}.href`, issue);
  }
  if (value.type === "color") {
    rejectUnknownKeys(value, ["type", "color"], path, issue);
    return validateColor(value.color, `${path}.color`, issue);
  }
  issue("rich-text.mark-type", `${path}.type`, "지원하지 않는 mark type입니다.");
  return false;
}

function validateImageValue(
  value: unknown,
  path: string,
  issue: IssueWriter,
  nodeFieldsAllowed = false,
): value is ImageValue {
  if (!isRecord(value)) {
    issue("image.value", path, "image 값은 객체여야 합니다.");
    return false;
  }
  if (!nodeFieldsAllowed) rejectUnknownKeys(value, ["assetId", "alt"], path, issue);
  let valid = requireString(value.alt, `${path}.alt`, issue);
  if (value.assetId !== undefined) valid = requireNonEmptyString(value.assetId, `${path}.assetId`, issue) && valid;
  return valid;
}

function validateAssetReferencesInValue(
  value: ComponentPropValue,
  path: string,
  assets: Record<string, DocumentAsset>,
  issue: IssueWriter,
): void {
  if (!isRecord(value) || !("alt" in value) || !("assetId" in value) || value.assetId === undefined) return;
  if (!assets[String(value.assetId)]) issue("prop.asset-missing", `${path}.assetId`, "참조한 asset을 찾을 수 없습니다.");
}

function validateColor(value: unknown, path: string, issue: IssueWriter): value is ColorValue {
  if (!isRecord(value)) {
    issue("color.type", path, "색상은 객체여야 합니다.");
    return false;
  }
  if (value.kind === "token") {
    rejectUnknownKeys(value, ["kind", "token"], path, issue);
    if (typeof value.token === "string" && /^[a-z][a-z0-9.-]*$/i.test(value.token)) return true;
    issue("color.token", `${path}.token`, "색상 token 형식이 올바르지 않습니다.");
    return false;
  }
  if (value.kind === "hex") {
    rejectUnknownKeys(value, ["kind", "value"], path, issue);
    if (typeof value.value === "string" && /^#[0-9a-f]{6}$/i.test(value.value)) return true;
    issue("color.hex", `${path}.value`, "색상은 #RRGGBB 형식이어야 합니다.");
    return false;
  }
  issue("color.kind", `${path}.kind`, "색상 kind가 올바르지 않습니다.");
  return false;
}

function validateWidth(value: unknown, path: string, issue: IssueWriter): boolean {
  if (!isRecord(value)) {
    issue("width.type", path, "width는 객체여야 합니다.");
    return false;
  }
  if (value.mode === "auto" || value.mode === "fill") {
    rejectUnknownKeys(value, ["mode"], path, issue);
    return true;
  }
  if (value.mode === "fixed") {
    rejectUnknownKeys(value, ["mode", "valuePt"], path, issue);
    return requirePositiveNumber(value.valuePt, `${path}.valuePt`, issue);
  }
  issue("width.mode", `${path}.mode`, "width mode가 올바르지 않습니다.");
  return false;
}

function isPropValueType(value: unknown): value is ComponentPropValueType {
  return ["text", "rich-text", "markdown", "number", "boolean", "image"].includes(String(value));
}

function isBindingProperty(value: unknown): value is ComponentPropDefinition["binding"]["property"] {
  return ["text.value", "rich-text.value", "markdown.source", "image.value"].includes(String(value));
}

function requireString(value: unknown, path: string, issue: IssueWriter): value is string {
  if (typeof value === "string") return true;
  issue("value.string", path, "문자열이어야 합니다.");
  return false;
}

function requireNonEmptyString(value: unknown, path: string, issue: IssueWriter): value is string {
  if (typeof value === "string" && value.length > 0) return true;
  issue("value.non-empty-string", path, "비어 있지 않은 문자열이어야 합니다.");
  return false;
}

function requireBoolean(value: unknown, path: string, issue: IssueWriter): value is boolean {
  if (typeof value === "boolean") return true;
  issue("value.boolean", path, "boolean이어야 합니다.");
  return false;
}

function requireStringArray(value: unknown, path: string, issue: IssueWriter): value is string[] {
  if (Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.length > 0)) return true;
  issue("value.string-array", path, "비어 있지 않은 문자열의 배열이어야 합니다.");
  return false;
}

function requireIsoDate(value: unknown, path: string, issue: IssueWriter): value is string {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return true;
  issue("value.iso-date", path, "유효한 날짜 문자열이어야 합니다.");
  return false;
}

function requireNonNegativeInteger(value: unknown, path: string, issue: IssueWriter): value is number {
  if (Number.isInteger(value) && Number(value) >= 0) return true;
  issue("value.non-negative-integer", path, "0 이상의 정수여야 합니다.");
  return false;
}

function requireNonNegativeNumber(value: unknown, path: string, issue: IssueWriter): value is number {
  if (isNonNegativeNumber(value)) return true;
  issue("value.non-negative-number", path, "0 이상의 유한한 숫자여야 합니다.");
  return false;
}

function requirePositiveNumber(value: unknown, path: string, issue: IssueWriter): value is number {
  if (isFiniteNumber(value) && value > 0) return true;
  issue("value.positive-number", path, "0보다 큰 유한한 숫자여야 합니다.");
  return false;
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowedKeys: string[],
  path: string,
  issue: IssueWriter,
): void {
  const allowed = new Set(allowedKeys);
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) {
      issue("object.unknown-key", `${path}.${key}`, "schema에 정의되지 않은 속성입니다.");
    }
  });
}
