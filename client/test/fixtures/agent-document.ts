import type * as Types from "./types.ts";
import { addNode, addComponentDefinition, addComponentInstance, archiveNode } from "../../src/foundation/document.ts";
export function agentDocument(document: Types.DocumentData) {
  const root = document.rootNodeId;
  document = addNode(document, root, { id: "text", type: "text", name: "같은 이름", visible: true, value: "원문 한글" });
  document = addNode(document, root, { id: "markdown", type: "markdown", name: "같은 이름", visible: false, source: "| 값 |\n| --- |\n| 표 |\n\n![이미지](https://example.com/a.png)" });
  document = addNode(document, root, { id: "archived", type: "text", name: "보관", visible: true, value: "보관 내용" });
  document = archiveNode(document, "archived");
  document = addComponentDefinition(document, { id: "component", name: "카드", rootNodeId: "definition", propDefinitions: [
    { id: "prop", name: "본문", status: "active", valueType: "markdown", binding: { nodeId: "definition-markdown", property: "markdown.source" }, defaultValue: "기본 **원문**" },
    { id: "old-prop", name: "이전 본문", status: "archived", valueType: "text", binding: { nodeId: "definition-text", property: "text.value" }, defaultValue: "보관" },
  ] }, {
    definition: { id: "definition", type: "container", name: "카드", visible: true, childIds: ["definition-markdown", "definition-text"] },
    "definition-markdown": { id: "definition-markdown", type: "markdown", name: "본문", visible: true, source: "기본 **원문**" },
    "definition-text": { id: "definition-text", type: "text", name: "이전 본문", visible: true, value: "보관" },
  });
  document = addComponentInstance(document, root, { id: "instance", name: "카드", type: "component-instance", visible: true, componentId: "component", props: {} });
  document = addNode(document, root, { id: "repeater", name: "항목", type: "repeater", visible: true, itemComponentId: "component", items: [
    { id: "item", componentId: "component", visible: false, props: { prop: "항목 원문" } },
  ] });
  document.assets.image = { id: "image", type: "image", name: "첨부", mimeType: "image/png", dataUrl: "data:image/png;base64,aW1hZ2U=" };
  return document;
}
