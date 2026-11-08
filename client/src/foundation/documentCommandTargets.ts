import type { DocumentData, DocumentNode, ComponentPropDefinition } from "./documentModel.ts";
import { readDocumentEditValue, type DocumentEditTarget } from "./documentEditing.ts";
import { collectDocumentTreeNodeIds } from "./documentTransactions.ts";
import { failure } from "./documentCommands.ts";

export function documentTree(document: DocumentData, includeArchived = false): Set<string> {
  const active = collectDocumentTreeNodeIds(document);
  if (!includeArchived) return active;
  const parents = new Map<string, string>();
  for (const node of Object.values(document.nodes)) {
    if (node.type === "container") for (const child of node.childIds) parents.set(child, node.id);
    if (node.archivedFrom) parents.set(node.id, node.archivedFrom.parentId);
  }
  for (const id of Object.keys(document.nodes)) {
    let current: string | undefined = id;
    const seen = new Set<string>();
    while (current && !seen.has(current)) {
      if (active.has(current)) { active.add(id); break; }
      seen.add(current); current = parents.get(current);
    }
  }
  return active;
}
export function requireDocumentNode(document: DocumentData, id: string, includeArchived = false): DocumentNode {
  if (!documentTree(document, includeArchived).has(id)) failure("INVALID_TARGET", "문서의 편집 가능한 요소가 아닙니다.");
  const node = document.nodes[id];
  if (!node) failure("INVALID_TARGET", "문서의 편집 가능한 요소가 아닙니다.");
  return node;
}
export function requireProp(document: DocumentData, componentId: string, propId: string): ComponentPropDefinition {
  const prop = document.components[componentId]?.propDefinitions.find((prop) => prop.id === propId && prop.status === "active");
  if (!prop) failure("INVALID_TARGET", "활성 컴포넌트 입력 항목을 찾을 수 없습니다.");
  const bound = document.nodes[prop.binding.nodeId];
  const binding = { text: "text.value", "rich-text": "rich-text.value", markdown: "markdown.source", image: "image.value" } as const;
  if (!bound || !(bound.type in binding) || binding[bound.type as keyof typeof binding] !== prop.binding.property) failure("INVALID_TARGET", "입력 항목의 연결 대상이 올바르지 않습니다.");
  return prop;
}
export function targetMetadata(document: DocumentData, target: DocumentEditTarget) {
  const nodeId = target.kind === "node" ? target.nodeId : target.kind === "component-prop" ? target.instanceNodeId : target.repeaterNodeId;
  const node = requireDocumentNode(document, nodeId);
  let valueType: string;
  let valueSource: "node" | "default" | "override" = "node";
  let label = node.name;
  if (target.kind === "node") valueType = node.type;
  else if (target.kind === "component-prop") {
    if (node.type !== "component-instance") failure("INVALID_TARGET", "컴포넌트 instance가 아닙니다.");
    const prop = requireProp(document, node.componentId, target.propId);
    valueType = prop.valueType; label = `${label} / ${prop.name}`;
    valueSource = Object.hasOwn(node.props, prop.id) ? "override" : "default";
  } else {
    if (node.type !== "repeater") failure("INVALID_TARGET", "반복 요소가 아닙니다.");
    const item = node.items.find((item) => item.id === target.itemId);
    if (!item) failure("INVALID_TARGET", "반복 항목을 찾을 수 없습니다.");
    const prop = requireProp(document, item.componentId, target.propId);
    valueType = prop.valueType; label = `${label} / ${node.items.indexOf(item) + 1} / ${prop.name}${item.visible ? "" : " (숨김)"}`;
    valueSource = Object.hasOwn(item.props, prop.id) ? "override" : "default";
  }
  if (valueType !== "text" && valueType !== "markdown" && valueType !== "rich-text") failure("INVALID_TARGET", "직접 편집 가능한 텍스트 대상이 아닙니다.");
  return { nodeId, valueType, valueSource, label: `${label}${node.visible ? "" : " (숨김)"}` };
}
export function readEditTarget(document: DocumentData, target: DocumentEditTarget) {
  const metadata = targetMetadata(document, target);
  return { ...metadata, target, value: readDocumentEditValue(document, target) };
}
export function listEditTargets(document: DocumentData) {
  const items: Array<ReturnType<typeof targetMetadata> & { target: DocumentEditTarget; breadcrumb: string[]; supportedOperations: string[] }> = [];
  const add = (target: DocumentEditTarget, breadcrumb: string[]) => {
    const metadata = targetMetadata(document, target);
    items.push({ ...metadata, target, breadcrumb, supportedOperations: metadata.valueType === "rich-text" ? ["set_edit_value"] : ["set_edit_value", "replace_text"] });
  };
  const visit = (id: string, path: string[]) => {
    const node = document.nodes[id];
    if (!node) failure("INVALID_TARGET", "문서 요소를 찾을 수 없습니다.");
    const breadcrumb = [...path, `${node.name}${node.visible ? "" : " (숨김)"}`];
    if (node.type === "text" || node.type === "markdown" || node.type === "rich-text") add({ kind: "node", nodeId: id }, breadcrumb);
    if (node.type === "container") node.childIds.forEach((child) => visit(child, breadcrumb));
    if (node.type === "component-instance") {
      for (const prop of requireTargetComponent(document, node.componentId).propDefinitions) {
        if (prop.status === "active" && ["text", "markdown", "rich-text"].includes(prop.valueType)) add({ kind: "component-prop", instanceNodeId: id, propId: prop.id }, [...breadcrumb, prop.name]);
      }
    }
    if (node.type === "repeater") for (const item of node.items) {
      for (const prop of requireTargetComponent(document, item.componentId).propDefinitions) {
        if (prop.status === "active" && ["text", "markdown", "rich-text"].includes(prop.valueType)) add({ kind: "repeater-item-prop", repeaterNodeId: id, itemId: item.id, propId: prop.id }, [...breadcrumb, `${node.items.indexOf(item) + 1}${item.visible ? "" : " (숨김)"}`, prop.name]);
      }
    }
  };
  visit(document.rootNodeId, []);
  return items.map(({ nodeId: _nodeId, ...item }) => item);
}

function requireTargetComponent(document: DocumentData, id: string) {
  const component = document.components[id];
  if (!component) failure("INVALID_TARGET", "컴포넌트를 찾을 수 없습니다.");
  return component;
}
