import { requiredValue } from "../../foundation/requiredValue.ts";
import { createEntityId, type DocumentData } from "../../foundation/documentModel.ts";
import type { ComponentLibraryItem } from "../../foundation/componentLibrary.ts";
import { addComponentInstance } from "../../foundation/documentTransactions.ts";
import { setComponentInstanceProp, clearComponentInstanceProp, setRepeaterItemProp, addRepeaterItemFromDefaults, moveRepeaterItem, duplicateRepeaterItem, removeRepeaterItem, importComponentPackage } from "../../foundation/documentComponentOperations.ts";
import { requireDocumentNode, requireProp } from "../../foundation/documentCommandTargets.ts";
import { failure, type Operation } from "../../foundation/documentCommands.ts";
import { documentRevision } from "./documentRevision.ts";
import { requireContainer, validateIndex, type OperationStep } from "./nodeOperations.ts";

export const COMPONENT_OPERATIONS = ["set_component_prop", "clear_component_prop", "add_item", "move_item", "duplicate_item", "remove_item", "set_item_prop", "import_component", "add_component_instance"] as const;
export function applyComponentOperation(document: DocumentData, operation: Operation, libraries: ReadonlyMap<string, ComponentLibraryItem>): OperationStep | undefined {
  const options = { now: () => document.updatedAt };
  if (operation.type === "set_component_prop" || operation.type === "clear_component_prop") {
    const node = requireDocumentNode(document, operation.instanceNodeId);
    if (node.type !== "component-instance") failure("INVALID_TARGET", "컴포넌트 instance가 아닙니다.");
    requireProp(document, node.componentId, operation.propId);
    return { document: operation.type === "set_component_prop"
      ? setComponentInstanceProp(document, node.id, operation.propId, operation.value, options)
      : clearComponentInstanceProp(document, node.id, operation.propId, options), nodeIds: [node.id] };
  }
  if (operation.type === "add_item" || operation.type === "move_item" || operation.type === "duplicate_item" || operation.type === "remove_item" || operation.type === "set_item_prop") {
    const node = requireDocumentNode(document, operation.repeaterNodeId);
    if (node.type !== "repeater") failure("INVALID_TARGET", "반복 요소가 아닙니다.");
    if (operation.type === "add_item") {
      validateIndex(operation.index, node.items.length);
      const added = addRepeaterItemFromDefaults(document, node.id, options);
      const next = operation.index === undefined ? added.document : moveRepeaterItem(added.document, node.id, added.itemId, operation.index, options);
      return { document: next, nodeIds: [node.id], created: { itemId: added.itemId } };
    }
    const item = node.items.find((item) => item.id === operation.itemId);
    if (!item) failure("INVALID_TARGET", "반복 항목을 찾을 수 없습니다.");
    if (operation.type === "move_item") {
      validateIndex(operation.index, node.items.length - 1);
      return { document: moveRepeaterItem(document, node.id, item.id, operation.index, options), nodeIds: [node.id] };
    }
    if (operation.type === "duplicate_item") {
      const copy = duplicateRepeaterItem(document, node.id, item.id, options);
      return { document: copy.document, nodeIds: [node.id], created: { itemId: copy.itemId } };
    }
    if (operation.type === "remove_item") return { document: removeRepeaterItem(document, node.id, item.id, options), nodeIds: [node.id], removedItemIds: [item.id] };
    requireProp(document, item.componentId, operation.propId);
    return { document: setRepeaterItemProp(document, node.id, item.id, operation.propId, operation.value, options), nodeIds: [node.id] };
  }
  if (operation.type === "add_component_instance") {
    const parent = requireContainer(document, operation.parentId); validateIndex(operation.index, parent.childIds.length);
    if (!Object.hasOwn(document.components, operation.componentId)) failure("INVALID_TARGET", "문서의 컴포넌트 정의를 찾을 수 없습니다.");
    const id = createEntityId("node");
    return { document: addComponentInstance(document, parent.id, { id, type: "component-instance", name: operation.name, visible: true, componentId: operation.componentId, props: {} }, operation.index, options), nodeIds: [parent.id, id], created: { nodeId: id } };
  }
  if (operation.type === "import_component") {
    const library = libraries.get(operation.libraryItemId);
    if (!library) failure("NOT_FOUND_OR_DENIED", "라이브러리 항목을 찾을 수 없거나 접근할 수 없습니다.");
    if (documentRevision(library) !== operation.expectedLibraryRevision) failure("REVISION_CONFLICT", "라이브러리 항목이 변경되었습니다. 다시 조회하세요.", { currentRevision: documentRevision(library) });
    const imported = importComponentPackage(document, library.package, options);
    // Qualified source keys avoid ambiguity when different entity kinds share an old ID.
    const idMap: Record<string, string> = {};
    for (const [kind, map] of Object.entries(imported.idMaps)) for (const [source, target] of map) idMap[`${kind}:${source}`] = target;
    for (const [oldId, newId] of imported.idMaps.components) {
      requiredValue(library.package.components[oldId], `source component ${oldId}`).propDefinitions.forEach((prop, index) => {
        idMap[`props:${oldId}:${prop.id}`] = requiredValue(requiredValue(imported.document.components[newId], `component ${newId}`).propDefinitions[index], `prop ${index}`).id;
      });
    }
    for (const [oldId, newId] of imported.idMaps.nodes) {
      const source = requiredValue(library.package.nodes[oldId], `source node ${oldId}`); const target = requiredValue(imported.document.nodes[newId], `node ${newId}`);
      if (source.type === "repeater" && target.type === "repeater") source.items.forEach((item, index) => { idMap[`items:${oldId}:${item.id}`] = requiredValue(target.items[index], `item ${index}`).id; });
    }
    return { document: imported.document, nodeIds: [...imported.idMaps.nodes.values()], created: { componentId: imported.componentId }, idMap };
  }
  return undefined;
}
