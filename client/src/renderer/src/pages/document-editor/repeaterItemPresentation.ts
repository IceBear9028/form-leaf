import type {
  ComponentInstanceValue,
  ComponentPropValue,
  DocumentData,
  DocumentNode,
} from "../../../../foundation/documentModel.ts";

export function repeaterItemLabel(
  document: DocumentData,
  repeater: Extract<DocumentNode, { type: "repeater" }>,
  item: ComponentInstanceValue,
  index: number,
): string {
  const component = document.components[repeater.itemComponentId];
  const summary = component?.propDefinitions
    .filter((definition) => definition.status === "active")
    .map((definition) => displayValue(
      Object.hasOwn(item.props, definition.id) ? item.props[definition.id] : definition.defaultValue,
    ))
    .find(Boolean);
  const fallback = `항목 ${index + 1}`;
  return summary ? `${fallback} · ${summary}` : fallback;
}

function displayValue(value: ComponentPropValue): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if ("runs" in value) {
    const text = value.runs.map((run) => run.text).join("").trim();
    return text || undefined;
  }
  return value.alt.trim() || undefined;
}
