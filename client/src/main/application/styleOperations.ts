import { requiredValue } from "../../foundation/requiredValue.ts";
import { createEntityId, type DocumentData, type StyleDefinition } from "../../foundation/documentModel.ts";
import { requireDocumentNode } from "../../foundation/documentCommandTargets.ts";
import { stylePatchSchema } from "../../foundation/documentCommandSchemas.ts";
import { failure, type Operation } from "../../foundation/documentCommands.ts";
import { stableSerialize } from "./documentRevision.ts";
import type { OperationStep } from "./nodeOperations.ts";

export function applyStyleOperation(document: DocumentData, operation: Operation, fonts: ReadonlySet<string>): OperationStep | undefined {
  if (operation.type !== "update_node_style") return;
  const node = requireDocumentNode(document, operation.nodeId);
  const parsed = stylePatchSchema.safeParse(operation.patch);
  if (!parsed.success) failure("VALIDATION_FAILED", "스타일 속성·유형·범위를 확인하세요.");
  const font = operation.patch.typography?.fontFamily;
  if (font && !fonts.has(font)) failure("VALIDATION_FAILED", "설치되었거나 앱에서 제공하는 font family만 사용할 수 있습니다.");
  const checkColors = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    // The current print stylesheet does not declare document color tokens.
    if ("kind" in value && value.kind === "token") failure("VALIDATION_FAILED", "현재 문서 스타일에 등록된 색상 token이 없습니다. #RRGGBB 색상을 사용하세요.");
    Object.values(value).forEach(checkColors);
  };
  checkColors(operation.patch);
  const current: StyleDefinition = node.styleId ? requiredValue(document.styles[node.styleId], `style ${node.styleId}`) : { id: "", name: `${node.name} style` };
  const nextStyle = merge(current, operation.patch) as StyleDefinition;
  if (stableSerialize(nextStyle) === stableSerialize(current)) return { document, nodeIds: [] };
  const shared = node.styleId && Object.values(document.nodes).some((other) => other.id !== node.id && other.styleId === node.styleId);
  const id = !node.styleId || shared ? createEntityId("style") : node.styleId;
  nextStyle.id = id;
  return { document: { ...document, styles: { ...document.styles, [id]: nextStyle }, nodes: { ...document.nodes, [node.id]: { ...node, styleId: id } } }, nodeIds: [node.id], ...(!node.styleId || shared ? { created: { styleId: id } } : {}) };
}
function merge(current: unknown, patch: unknown): unknown {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return structuredClone(patch);
  if ("mode" in patch || "kind" in patch) return structuredClone(patch);
  const result: Record<string, unknown> = current && typeof current === "object" && !Array.isArray(current) ? { ...current } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete result[key];
    else if (value !== undefined) {
      const merged = merge(result[key], value);
      if (merged === undefined) delete result[key]; else result[key] = merged;
    }
  }
  return Object.keys(result).length === 0 && current === undefined ? undefined : result;
}
