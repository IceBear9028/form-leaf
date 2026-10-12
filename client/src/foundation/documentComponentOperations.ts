import type {
  ComponentDefinition,
  ComponentInstanceValue,
  ComponentPropDefinition,
  ComponentPropValue,
  DocumentAsset,
  DocumentData,
  DocumentNode,
  ImageValue,
  NodeId,
  StyleDefinition,
} from "./documentModel.ts";
import { createEntityId } from "./documentModel.ts";
import type { DocumentTransactionOptions } from "./documentTransactions.ts";
import { assertDocumentData } from "./documentValidation.ts";

export type ComponentLibraryPackage = {
  schemaVersion: 1;
  name: string;
  entryComponentId: string;
  components: Record<string, ComponentDefinition>;
  nodes: Record<string, DocumentNode>;
  styles: Record<string, StyleDefinition>;
  assets: Record<string, DocumentAsset>;
};

export function createComponentFromSubtree(
  document: DocumentData,
  nodeId: NodeId,
  name: string,
  options?: DocumentTransactionOptions,
): { document: DocumentData; componentId: string; instanceNodeId: string } {
  assertDocumentData(document);
  const source = requireNode(document, nodeId);
  if (source.archivedFrom) throw new Error("보관된 node는 component로 만들 수 없습니다.");
  const parent = findParent(document, nodeId);
  if (!parent) throw new Error("document 또는 component root는 component로 바꿀 수 없습니다.");
  const index = parent.childIds.indexOf(nodeId);
  const createId = options?.createId ?? createEntityId;
  const componentId = createUniqueId("component", new Set(Object.keys(document.components)), createId);
  const instanceNodeId = createUniqueId("node", new Set(Object.keys(document.nodes)), createId);
  const instance: Extract<DocumentNode, { type: "component-instance" }> = {
    id: instanceNodeId,
    type: "component-instance",
    name: source.name,
    visible: source.visible,
    componentId,
    props: {},
  };
  const nextParent = {
    ...parent,
    childIds: parent.childIds.map((childId, childIndex) => childIndex === index ? instanceNodeId : childId),
  };
  const next = finalize({
    ...document,
    nodes: {
      ...document.nodes,
      [parent.id]: nextParent,
      [instanceNodeId]: instance,
    },
    components: {
      ...document.components,
      [componentId]: {
        id: componentId,
        name,
        rootNodeId: nodeId,
        propDefinitions: [],
      },
    },
  }, options);
  return { document: next, componentId, instanceNodeId };
}

export function exposeComponentProp(
  document: DocumentData,
  componentId: string,
  nodeId: NodeId,
  name: string,
  options?: DocumentTransactionOptions,
): { document: DocumentData; propId: string } {
  assertDocumentData(document);
  const component = requireComponent(document, componentId);
  if (!collectStructuralSubtree(document, component.rootNodeId).has(nodeId)) {
    throw new Error("component subtree 밖의 node는 prop으로 노출할 수 없습니다.");
  }
  const node = requireNode(document, nodeId);
  const binding = bindingForNode(node);
  if (component.propDefinitions.some((prop) => (
    prop.binding.nodeId === nodeId && prop.binding.property === binding.property
  ))) {
    throw new Error("이미 prop으로 노출된 node property입니다.");
  }
  const createId = options?.createId ?? createEntityId;
  const propId = createUniqueId(
    "prop",
    new Set(Object.values(document.components).flatMap((entry) => entry.propDefinitions.map((prop) => prop.id))),
    createId,
  );
  const definition: ComponentPropDefinition = {
    id: propId,
    name,
    status: "active",
    valueType: binding.valueType,
    binding: { nodeId, property: binding.property },
    defaultValue: binding.defaultValue,
  };
  return {
    document: finalize({
      ...document,
      components: {
        ...document.components,
        [componentId]: {
          ...component,
          propDefinitions: [...component.propDefinitions, definition],
        },
      },
    }, options),
    propId,
  };
}

export function applyComponentDefinitionDraft(
  document: DocumentData,
  draft: ComponentDefinition,
  options?: DocumentTransactionOptions,
): DocumentData {
  assertDocumentData(document);
  const current = requireComponent(document, draft.id);
  if (draft.rootNodeId !== current.rootNodeId) throw new Error("component root는 변경할 수 없습니다.");
  const draftProps = new Map(draft.propDefinitions.map((prop) => [prop.id, prop]));
  current.propDefinitions.forEach((prop) => {
    const next = draftProps.get(prop.id);
    if (!next) throw new Error("기존 prop은 삭제하지 않고 보관해야 합니다.");
    if (next.valueType !== prop.valueType || !sameBinding(next.binding, prop.binding)) {
      throw new Error("기존 prop의 type과 binding은 변경할 수 없습니다.");
    }
  });
  if (draft.propDefinitions.length !== current.propDefinitions.length) {
    throw new Error("새 prop은 node binding을 통해 추가해야 합니다.");
  }
  return finalize({
    ...document,
    components: { ...document.components, [draft.id]: structuredClone(draft) },
  }, options);
}

export function createComponentDocumentDraft(
  document: DocumentData,
  componentId: string,
  options?: Pick<DocumentTransactionOptions, "createId">,
): DocumentData {
  assertDocumentData(document);
  const component = requireComponent(document, componentId);
  const draft = structuredClone(document);
  const ownedNodeIds = collectComponentOwnedNodeIds(draft, component.rootNodeId);
  const outsideStyleIds = new Set(
    Object.values(draft.nodes)
      .filter((node) => !ownedNodeIds.has(node.id) && node.styleId)
      .map((node) => node.styleId!),
  );
  const createId = options?.createId ?? createEntityId;
  const usedStyleIds = new Set(Object.keys(draft.styles));
  const localizedStyles = new Map<string, string>();

  ownedNodeIds.forEach((nodeId) => {
    const node = draft.nodes[nodeId];
    if (!node?.styleId || !outsideStyleIds.has(node.styleId)) return;
    const sourceStyleId = node.styleId;
    let localStyleId = localizedStyles.get(sourceStyleId);
    if (!localStyleId) {
      localStyleId = createUniqueId("style", usedStyleIds, createId);
      localizedStyles.set(sourceStyleId, localStyleId);
      draft.styles[localStyleId] = {
        ...structuredClone(draft.styles[sourceStyleId]),
        id: localStyleId,
      };
    }
    draft.nodes[nodeId] = { ...node, styleId: localStyleId };
  });

  assertDocumentData(draft);
  return draft;
}

export function applyComponentDocumentDraft(
  document: DocumentData,
  componentId: string,
  draft: DocumentData,
  options?: DocumentTransactionOptions,
): DocumentData {
  assertDocumentData(document);
  assertDocumentData(draft);
  if (draft.documentId !== document.documentId) throw new Error("다른 문서의 component draft는 적용할 수 없습니다.");
  const currentComponent = requireComponent(document, componentId);
  const draftComponent = requireComponent(draft, componentId);
  if (draftComponent.rootNodeId !== currentComponent.rootNodeId) {
    throw new Error("component root는 변경할 수 없습니다.");
  }
  assertExistingPropsPreserved(currentComponent, draftComponent);

  const currentNodeIds = collectComponentOwnedNodeIds(document, currentComponent.rootNodeId);
  const draftNodeIds = collectComponentOwnedNodeIds(draft, draftComponent.rootNodeId);
  draftNodeIds.forEach((nodeId) => {
    if (!currentNodeIds.has(nodeId) && document.nodes[nodeId]) {
      throw new Error(`component 밖에서 사용 중인 node ID입니다: ${nodeId}`);
    }
  });

  const nodes = { ...document.nodes };
  currentNodeIds.forEach((nodeId) => delete nodes[nodeId]);
  draftNodeIds.forEach((nodeId) => {
    nodes[nodeId] = structuredClone(draft.nodes[nodeId]);
  });

  const styles = { ...document.styles };
  const draftStyleIds = new Set<string>();
  draftNodeIds.forEach((nodeId) => {
    const styleId = nodes[nodeId]?.styleId;
    if (!styleId) return;
    const style = draft.styles[styleId];
    if (!style) throw new Error(`component style을 찾을 수 없습니다: ${styleId}`);
    draftStyleIds.add(styleId);
    styles[styleId] = structuredClone(style);
  });

  const referencedStyleIds = new Set(
    Object.values(nodes).flatMap((node) => node.styleId ? [node.styleId] : []),
  );
  currentNodeIds.forEach((nodeId) => {
    const styleId = document.nodes[nodeId]?.styleId;
    if (styleId && !referencedStyleIds.has(styleId) && !draftStyleIds.has(styleId)) delete styles[styleId];
  });

  return finalize({
    ...document,
    nodes,
    styles,
    components: {
      ...document.components,
      [componentId]: structuredClone(draftComponent),
    },
  }, options);
}

export function setComponentInstanceProp(
  document: DocumentData,
  instanceNodeId: NodeId,
  propId: string,
  value: ComponentPropValue,
  options?: DocumentTransactionOptions,
): DocumentData {
  assertDocumentData(document);
  const node = requireNode(document, instanceNodeId);
  if (node.type !== "component-instance") throw new Error("대상 node가 component instance가 아닙니다.");
  return finalize({
    ...document,
    nodes: {
      ...document.nodes,
      [node.id]: { ...node, props: { ...node.props, [propId]: structuredClone(value) } },
    },
  }, options);
}

export function clearComponentInstanceProp(
  document: DocumentData,
  instanceNodeId: NodeId,
  propId: string,
  options?: DocumentTransactionOptions,
): DocumentData {
  assertDocumentData(document);
  const node = requireNode(document, instanceNodeId);
  if (node.type !== "component-instance") throw new Error("대상 node가 component instance가 아닙니다.");
  const props = { ...node.props };
  delete props[propId];
  return finalize({
    ...document,
    nodes: { ...document.nodes, [node.id]: { ...node, props } },
  }, options);
}

export function addRepeaterItemFromDefaults(
  document: DocumentData,
  repeaterNodeId: NodeId,
  options?: DocumentTransactionOptions,
): { document: DocumentData; itemId: string } {
  assertDocumentData(document);
  const node = requireRepeater(document, repeaterNodeId);
  const createId = options?.createId ?? createEntityId;
  const itemId = createUniqueId("item", collectRepeaterItemIds(document), createId);
  const item: ComponentInstanceValue = {
    id: itemId,
    componentId: node.itemComponentId,
    visible: true,
    props: {},
  };
  return {
    document: finalize({
      ...document,
      nodes: {
        ...document.nodes,
        [node.id]: { ...node, items: [...node.items, item] },
      },
    }, options),
    itemId,
  };
}

export function duplicateRepeaterItem(
  document: DocumentData,
  repeaterNodeId: NodeId,
  itemId: string,
  options?: DocumentTransactionOptions,
): { document: DocumentData; itemId: string } {
  assertDocumentData(document);
  const node = requireRepeater(document, repeaterNodeId);
  const index = node.items.findIndex((item) => item.id === itemId);
  if (index < 0) throw new Error(`repeater item을 찾을 수 없습니다: ${itemId}`);
  const createId = options?.createId ?? createEntityId;
  const nextItemId = createUniqueId("item", collectRepeaterItemIds(document), createId);
  const item = { ...structuredClone(node.items[index]), id: nextItemId };
  const items = [...node.items];
  items.splice(index + 1, 0, item);
  return {
    document: finalize({
      ...document,
      nodes: { ...document.nodes, [node.id]: { ...node, items } },
    }, options),
    itemId: nextItemId,
  };
}

export function removeRepeaterItem(
  document: DocumentData,
  repeaterNodeId: NodeId,
  itemId: string,
  options?: DocumentTransactionOptions,
): DocumentData {
  assertDocumentData(document);
  const node = requireRepeater(document, repeaterNodeId);
  if (!node.items.some((item) => item.id === itemId)) {
    throw new Error(`repeater item을 찾을 수 없습니다: ${itemId}`);
  }
  return finalize({
    ...document,
    nodes: {
      ...document.nodes,
      [node.id]: { ...node, items: node.items.filter((item) => item.id !== itemId) },
    },
  }, options);
}

export function moveRepeaterItem(
  document: DocumentData,
  repeaterNodeId: NodeId,
  itemId: string,
  targetIndex: number,
  options?: DocumentTransactionOptions,
): DocumentData {
  assertDocumentData(document);
  const node = requireRepeater(document, repeaterNodeId);
  const index = node.items.findIndex((item) => item.id === itemId);
  if (index < 0) throw new Error(`repeater item을 찾을 수 없습니다: ${itemId}`);
  if (!Number.isInteger(targetIndex)) throw new Error("이동 위치는 정수여야 합니다.");
  const items = [...node.items];
  const [item] = items.splice(index, 1);
  items.splice(Math.min(Math.max(targetIndex, 0), items.length), 0, item);
  return finalize({
    ...document,
    nodes: { ...document.nodes, [node.id]: { ...node, items } },
  }, options);
}

export function setRepeaterItemVisibility(
  document: DocumentData,
  repeaterNodeId: NodeId,
  itemId: string,
  visible: boolean,
  options?: DocumentTransactionOptions,
): DocumentData {
  return updateRepeaterItem(document, repeaterNodeId, itemId, (item) => ({ ...item, visible }), options);
}

export function setRepeaterItemProp(
  document: DocumentData,
  repeaterNodeId: NodeId,
  itemId: string,
  propId: string,
  value: ComponentPropValue,
  options?: DocumentTransactionOptions,
): DocumentData {
  return updateRepeaterItem(document, repeaterNodeId, itemId, (item) => ({
    ...item,
    props: { ...item.props, [propId]: structuredClone(value) },
  }), options);
}

export function clearRepeaterItemProp(
  document: DocumentData,
  repeaterNodeId: NodeId,
  itemId: string,
  propId: string,
  options?: DocumentTransactionOptions,
): DocumentData {
  return updateRepeaterItem(document, repeaterNodeId, itemId, (item) => {
    const props = { ...item.props };
    delete props[propId];
    return { ...item, props };
  }, options);
}

export function exportComponentPackage(
  document: DocumentData,
  entryComponentId: string,
): ComponentLibraryPackage {
  assertDocumentData(document);
  const componentIds = collectComponentDependencies(document, entryComponentId);
  const nodeIds = new Set<string>();
  componentIds.forEach((componentId) => {
    const component = requireComponent(document, componentId);
    collectStructuralSubtree(document, component.rootNodeId).forEach((nodeId) => nodeIds.add(nodeId));
  });
  const styleIds = new Set<string>();
  const assetIds = new Set<string>();
  nodeIds.forEach((nodeId) => {
    const node = requireNode(document, nodeId);
    if (node.styleId) styleIds.add(node.styleId);
    collectNodeAssetReferences(node).forEach((assetId) => assetIds.add(assetId));
  });
  componentIds.forEach((componentId) => {
    requireComponent(document, componentId).propDefinitions.forEach((prop) => {
      collectValueAssetReferences(prop.defaultValue).forEach((assetId) => assetIds.add(assetId));
    });
  });
  return {
    schemaVersion: 1,
    name: requireComponent(document, entryComponentId).name,
    entryComponentId,
    components: pickRecord(document.components, componentIds),
    nodes: pickRecord(document.nodes, nodeIds),
    styles: pickRecord(document.styles, styleIds),
    assets: pickRecord(document.assets, assetIds),
  };
}

export function importComponentPackage(
  document: DocumentData,
  componentPackage: ComponentLibraryPackage,
  options?: DocumentTransactionOptions,
): {
  document: DocumentData;
  componentId: string;
  idMaps: {
    components: Map<string, string>;
    nodes: Map<string, string>;
    styles: Map<string, string>;
    assets: Map<string, string>;
  };
} {
  assertDocumentData(document);
  if (componentPackage.schemaVersion !== 1) throw new Error("지원하지 않는 component package version입니다.");
  if (!componentPackage.components[componentPackage.entryComponentId]) {
    throw new Error("component package의 entry를 찾을 수 없습니다.");
  }
  const createId = options?.createId ?? createEntityId;
  const componentMap = allocateMap(Object.keys(componentPackage.components), "component", new Set(Object.keys(document.components)), createId);
  const nodeMap = allocateMap(Object.keys(componentPackage.nodes), "node", new Set(Object.keys(document.nodes)), createId);
  const styleMap = allocateMap(Object.keys(componentPackage.styles), "style", new Set(Object.keys(document.styles)), createId);
  const assetMap = allocateMap(Object.keys(componentPackage.assets), "asset", new Set(Object.keys(document.assets)), createId);
  const usedPropIds = new Set(Object.values(document.components).flatMap((component) => component.propDefinitions.map((prop) => prop.id)));
  const propMaps = new Map<string, Map<string, string>>();
  Object.values(componentPackage.components).forEach((component) => {
    propMaps.set(component.id, allocateMap(
      component.propDefinitions.map((prop) => prop.id),
      "prop",
      usedPropIds,
      createId,
    ));
  });
  const usedItemIds = collectRepeaterItemIds(document);

  const assets: Record<string, DocumentAsset> = {};
  Object.values(componentPackage.assets).forEach((asset) => {
    const id = requireMapped(assetMap, asset.id, "asset");
    assets[id] = { ...structuredClone(asset), id };
  });
  const styles: Record<string, StyleDefinition> = {};
  Object.values(componentPackage.styles).forEach((style) => {
    const id = requireMapped(styleMap, style.id, "style");
    styles[id] = { ...structuredClone(style), id };
  });
  const nodes: Record<string, DocumentNode> = {};
  Object.values(componentPackage.nodes).forEach((source) => {
    const id = requireMapped(nodeMap, source.id, "node");
    const common = {
      ...structuredClone(source),
      id,
      styleId: source.styleId ? requireMapped(styleMap, source.styleId, "style") : undefined,
    };
    if (source.type === "container") {
      nodes[id] = { ...common, type: source.type, childIds: source.childIds.map((childId) => requireMapped(nodeMap, childId, "node")) };
    } else if (source.type === "image") {
      nodes[id] = {
        ...common,
        type: source.type,
        alt: source.alt,
        assetId: source.assetId ? requireMapped(assetMap, source.assetId, "asset") : undefined,
      };
    } else if (source.type === "component-instance") {
      nodes[id] = {
        ...common,
        type: source.type,
        componentId: requireMapped(componentMap, source.componentId, "component"),
        props: remapProps(source.componentId, source.props, propMaps, assetMap),
      };
    } else if (source.type === "repeater") {
      nodes[id] = {
        ...common,
        type: source.type,
        itemComponentId: requireMapped(componentMap, source.itemComponentId, "component"),
        items: source.items.map((item) => ({
          ...structuredClone(item),
          id: createUniqueId("item", usedItemIds, createId),
          componentId: requireMapped(componentMap, item.componentId, "component"),
          props: remapProps(item.componentId, item.props, propMaps, assetMap),
        })),
      };
    } else {
      nodes[id] = { ...common, type: source.type } as DocumentNode;
    }
    if (!source.styleId) delete nodes[id].styleId;
  });
  const components: Record<string, ComponentDefinition> = {};
  Object.values(componentPackage.components).forEach((source) => {
    const id = requireMapped(componentMap, source.id, "component");
    const propMap = propMaps.get(source.id)!;
    components[id] = {
      ...structuredClone(source),
      id,
      rootNodeId: requireMapped(nodeMap, source.rootNodeId, "node"),
      propDefinitions: source.propDefinitions.map((prop) => ({
        ...structuredClone(prop),
        id: requireMapped(propMap, prop.id, "prop"),
        binding: {
          ...prop.binding,
          nodeId: requireMapped(nodeMap, prop.binding.nodeId, "node"),
        },
        defaultValue: remapValueAssets(prop.defaultValue, assetMap),
      })),
    };
  });
  const next = finalize({
    ...document,
    components: { ...document.components, ...components },
    nodes: { ...document.nodes, ...nodes },
    styles: { ...document.styles, ...styles },
    assets: { ...document.assets, ...assets },
  }, options);
  return {
    document: next,
    componentId: requireMapped(componentMap, componentPackage.entryComponentId, "component"),
    idMaps: { components: componentMap, nodes: nodeMap, styles: styleMap, assets: assetMap },
  };
}

function updateRepeaterItem(
  document: DocumentData,
  repeaterNodeId: NodeId,
  itemId: string,
  update: (item: ComponentInstanceValue) => ComponentInstanceValue,
  options?: DocumentTransactionOptions,
): DocumentData {
  assertDocumentData(document);
  const node = requireRepeater(document, repeaterNodeId);
  if (!node.items.some((item) => item.id === itemId)) {
    throw new Error(`repeater item을 찾을 수 없습니다: ${itemId}`);
  }
  return finalize({
    ...document,
    nodes: {
      ...document.nodes,
      [node.id]: {
        ...node,
        items: node.items.map((item) => item.id === itemId ? update(structuredClone(item)) : item),
      },
    },
  }, options);
}

function bindingForNode(node: DocumentNode): {
  property: ComponentPropDefinition["binding"]["property"];
  valueType: ComponentPropDefinition["valueType"];
  defaultValue: ComponentPropValue;
} {
  if (node.type === "text") return { property: "text.value", valueType: "text", defaultValue: node.value };
  if (node.type === "rich-text") return { property: "rich-text.value", valueType: "rich-text", defaultValue: structuredClone(node.value) };
  if (node.type === "markdown") return { property: "markdown.source", valueType: "markdown", defaultValue: node.source };
  if (node.type === "image") {
    const value: ImageValue = { alt: node.alt };
    if (node.assetId) value.assetId = node.assetId;
    return { property: "image.value", valueType: "image", defaultValue: value };
  }
  throw new Error("이 node type은 component prop으로 노출할 수 없습니다.");
}

function collectComponentDependencies(document: DocumentData, entryComponentId: string): Set<string> {
  const result = new Set<string>();
  const visit = (componentId: string) => {
    if (result.has(componentId)) return;
    const component = requireComponent(document, componentId);
    result.add(componentId);
    collectStructuralSubtree(document, component.rootNodeId).forEach((nodeId) => {
      const node = requireNode(document, nodeId);
      if (node.type === "component-instance") visit(node.componentId);
      if (node.type === "repeater") visit(node.itemComponentId);
    });
  };
  visit(entryComponentId);
  return result;
}

function collectNodeAssetReferences(node: DocumentNode): Set<string> {
  const result = new Set<string>();
  if (node.type === "image" && node.assetId) result.add(node.assetId);
  if (node.type === "component-instance") {
    Object.values(node.props).forEach((value) => collectValueAssetReferences(value).forEach((id) => result.add(id)));
  }
  if (node.type === "repeater") {
    node.items.forEach((item) => Object.values(item.props).forEach((value) => (
      collectValueAssetReferences(value).forEach((id) => result.add(id))
    )));
  }
  return result;
}

function collectValueAssetReferences(value: ComponentPropValue): Set<string> {
  const result = new Set<string>();
  if (typeof value === "object" && "alt" in value && value.assetId) result.add(value.assetId);
  return result;
}

function remapProps(
  sourceComponentId: string,
  props: Record<string, ComponentPropValue>,
  propMaps: Map<string, Map<string, string>>,
  assetMap: Map<string, string>,
): Record<string, ComponentPropValue> {
  const propMap = propMaps.get(sourceComponentId);
  if (!propMap) throw new Error(`package dependency component를 찾을 수 없습니다: ${sourceComponentId}`);
  return Object.fromEntries(Object.entries(props).map(([propId, value]) => [
    requireMapped(propMap, propId, "prop"),
    remapValueAssets(value, assetMap),
  ]));
}

function remapValueAssets(value: ComponentPropValue, assetMap: Map<string, string>): ComponentPropValue {
  const copy = structuredClone(value);
  if (typeof copy !== "object" || !("alt" in copy) || !copy.assetId) return copy;
  return { ...copy, assetId: requireMapped(assetMap, copy.assetId, "asset") };
}

function allocateMap(
  sourceIds: string[],
  prefix: string,
  usedIds: Set<string>,
  createId: (prefix: string) => string,
): Map<string, string> {
  return new Map(sourceIds.map((sourceId) => [sourceId, createUniqueId(prefix, usedIds, createId)]));
}

function requireMapped(map: Map<string, string>, sourceId: string, kind: string): string {
  const result = map.get(sourceId);
  if (!result) throw new Error(`package ${kind} dependency를 찾을 수 없습니다: ${sourceId}`);
  return result;
}

function pickRecord<T>(source: Record<string, T>, ids: Set<string>): Record<string, T> {
  return Object.fromEntries([...ids].map((id) => {
    const value = source[id];
    if (!value) throw new Error(`dependency를 찾을 수 없습니다: ${id}`);
    return [id, structuredClone(value)];
  }));
}

function collectStructuralSubtree(document: DocumentData, rootNodeId: NodeId): Set<NodeId> {
  const result = new Set<NodeId>();
  const visit = (nodeId: NodeId) => {
    if (result.has(nodeId)) return;
    const node = requireNode(document, nodeId);
    result.add(nodeId);
    if (node.type === "container") node.childIds.forEach(visit);
  };
  visit(rootNodeId);
  return result;
}

function collectComponentOwnedNodeIds(document: DocumentData, rootNodeId: NodeId): Set<NodeId> {
  const result = collectStructuralSubtree(document, rootNodeId);
  let changed = true;
  while (changed) {
    changed = false;
    Object.values(document.nodes).forEach((node) => {
      if (!node.archivedFrom || result.has(node.id) || !result.has(node.archivedFrom.parentId)) return;
      collectStructuralSubtree(document, node.id).forEach((nodeId) => {
        if (!result.has(nodeId)) {
          result.add(nodeId);
          changed = true;
        }
      });
    });
  }
  return result;
}

function assertExistingPropsPreserved(
  current: ComponentDefinition,
  draft: ComponentDefinition,
): void {
  const draftProps = new Map(draft.propDefinitions.map((prop) => [prop.id, prop]));
  current.propDefinitions.forEach((prop) => {
    const next = draftProps.get(prop.id);
    if (!next) throw new Error("기존 prop은 삭제하지 않고 보관해야 합니다.");
    if (next.valueType !== prop.valueType || !sameBinding(next.binding, prop.binding)) {
      throw new Error("기존 prop의 type과 binding은 변경할 수 없습니다.");
    }
  });
}

function collectRepeaterItemIds(document: DocumentData): Set<string> {
  return new Set(Object.values(document.nodes).flatMap((node) => (
    node.type === "repeater" ? node.items.map((item) => item.id) : []
  )));
}

function sameBinding(
  left: ComponentPropDefinition["binding"],
  right: ComponentPropDefinition["binding"],
): boolean {
  return left.nodeId === right.nodeId && left.property === right.property;
}

function requireNode(document: DocumentData, nodeId: NodeId): DocumentNode {
  const node = document.nodes[nodeId];
  if (!node) throw new Error(`node를 찾을 수 없습니다: ${nodeId}`);
  return node;
}

function requireComponent(document: DocumentData, componentId: string): ComponentDefinition {
  const component = document.components[componentId];
  if (!component) throw new Error(`component를 찾을 수 없습니다: ${componentId}`);
  return component;
}

function requireRepeater(
  document: DocumentData,
  nodeId: NodeId,
): Extract<DocumentNode, { type: "repeater" }> {
  const node = requireNode(document, nodeId);
  if (node.type !== "repeater") throw new Error("대상 node가 repeater가 아닙니다.");
  return node;
}

function findParent(
  document: DocumentData,
  nodeId: NodeId,
): Extract<DocumentNode, { type: "container" }> | undefined {
  return Object.values(document.nodes).find(
    (node): node is Extract<DocumentNode, { type: "container" }> => (
      node.type === "container" && node.childIds.includes(nodeId)
    ),
  );
}

function createUniqueId(
  prefix: string,
  usedIds: Set<string>,
  createId: (prefix: string) => string,
): string {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const id = createId(prefix);
    if (usedIds.has(id)) continue;
    usedIds.add(id);
    return id;
  }
  throw new Error("고유한 ID를 만들지 못했습니다.");
}

function finalize(document: DocumentData, options?: DocumentTransactionOptions): DocumentData {
  const next = {
    ...document,
    updatedAt: (options?.now ?? (() => new Date().toISOString()))(),
  };
  assertDocumentData(next);
  return next;
}
