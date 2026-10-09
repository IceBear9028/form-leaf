import type {
  ComponentPropDefinition,
  ComponentPropValue,
  DocumentData,
  RichTextMark,
  RichTextRun,
  RichTextValue,
} from "./documentModel.ts";
import type { DocumentTransactionOptions } from "./documentTransactions.ts";
import { updateNode } from "./documentTransactions.ts";
import {
  setComponentInstanceProp,
  setRepeaterItemProp,
} from "./documentComponentOperations.ts";

export type DocumentEditTarget =
  | { kind: "node"; nodeId: string }
  | { kind: "component-prop"; instanceNodeId: string; propId: string }
  | { kind: "repeater-item-prop"; repeaterNodeId: string; itemId: string; propId: string };

export type TextRange = { start: number; end: number };
export type DirectEditValue = string | RichTextValue;

export function documentEditTargetKey(target: DocumentEditTarget): string {
  if (target.kind === "node") return `node:${target.nodeId}`;
  if (target.kind === "component-prop") return `instance:${target.instanceNodeId}:prop:${target.propId}`;
  return `repeater:${target.repeaterNodeId}:item:${target.itemId}:prop:${target.propId}`;
}

export function readDocumentEditValue(
  document: DocumentData,
  target: DocumentEditTarget,
): DirectEditValue {
  if (target.kind === "node") {
    const node = document.nodes[target.nodeId];
    if (!node) throw new Error(`node를 찾을 수 없습니다: ${target.nodeId}`);
    if (node.type === "text") return node.value;
    if (node.type === "rich-text") return structuredClone(node.value);
    if (node.type === "markdown") return node.source;
    throw new Error("직접 편집할 수 없는 node type입니다.");
  }
  if (target.kind === "component-prop") {
    const node = document.nodes[target.instanceNodeId];
    if (node?.type !== "component-instance") throw new Error("component instance를 찾을 수 없습니다.");
    const definition = requireActiveProp(document, node.componentId, target.propId);
    return directValue(Object.hasOwn(node.props, target.propId) ? node.props[target.propId] : definition.defaultValue);
  }
  const node = document.nodes[target.repeaterNodeId];
  if (node?.type !== "repeater") throw new Error("repeater를 찾을 수 없습니다.");
  const item = node.items.find((entry) => entry.id === target.itemId);
  if (!item) throw new Error(`repeater item을 찾을 수 없습니다: ${target.itemId}`);
  const definition = requireActiveProp(document, item.componentId, target.propId);
  return directValue(Object.hasOwn(item.props, target.propId) ? item.props[target.propId] : definition.defaultValue);
}

export function updateDocumentEditValue(
  document: DocumentData,
  target: DocumentEditTarget,
  value: DirectEditValue,
  options?: DocumentTransactionOptions,
): DocumentData {
  const current = readDocumentEditValue(document, target);
  if (typeof current !== typeof value) throw new Error("편집 값의 type이 target과 일치하지 않습니다.");
  if (target.kind === "node") {
    return updateNode(document, target.nodeId, (node) => {
      if (node.type === "text" && typeof value === "string") return { ...node, value };
      if (node.type === "markdown" && typeof value === "string") return { ...node, source: value };
      if (node.type === "rich-text" && isRichTextValue(value)) return { ...node, value: structuredClone(value) };
      throw new Error("직접 편집 값과 node type이 일치하지 않습니다.");
    }, options);
  }
  if (target.kind === "component-prop") {
    return setComponentInstanceProp(document, target.instanceNodeId, target.propId, value, options);
  }
  return setRepeaterItemProp(
    document,
    target.repeaterNodeId,
    target.itemId,
    target.propId,
    value,
    options,
  );
}

export function replaceTextRange(source: string, range: TextRange, replacement: string): {
  value: string;
  selection: TextRange;
} {
  const normalized = normalizeRange(source.length, range);
  return {
    value: source.slice(0, normalized.start) + replacement + source.slice(normalized.end),
    selection: {
      start: normalized.start + replacement.length,
      end: normalized.start + replacement.length,
    },
  };
}

export function richTextPlainText(value: RichTextValue): string {
  return value.runs.map((run) => run.text).join("");
}

export function replaceRichTextRange(
  value: RichTextValue,
  range: TextRange,
  replacement: string,
): { value: RichTextValue; selection: TextRange } {
  const length = richTextPlainText(value).length;
  const normalized = normalizeRange(length, range);
  const before = sliceRichTextRuns(value, 0, normalized.start);
  const after = sliceRichTextRuns(value, normalized.end, length);
  const marks = marksAtOffset(value, normalized.start);
  const inserted: RichTextRun[] = replacement ? [{ text: replacement, ...(marks.length ? { marks } : {}) }] : [];
  return {
    value: { runs: normalizeRuns([...before, ...inserted, ...after]) },
    selection: {
      start: normalized.start + replacement.length,
      end: normalized.start + replacement.length,
    },
  };
}

export function toggleRichTextMark(
  value: RichTextValue,
  range: TextRange,
  mark: RichTextMark,
): RichTextValue {
  const length = richTextPlainText(value).length;
  const normalized = normalizeRange(length, range);
  if (normalized.start === normalized.end) return structuredClone(value);
  const remove = selectedRuns(value, normalized).every((run) => (
    (run.marks ?? []).some((entry) => entry.type === mark.type)
  ));
  let offset = 0;
  const runs: RichTextRun[] = [];
  value.runs.forEach((run) => {
    const start = offset;
    const end = start + run.text.length;
    offset = end;
    const overlapStart = Math.max(start, normalized.start);
    const overlapEnd = Math.min(end, normalized.end);
    if (start < overlapStart) runs.push(copyRunSlice(run, 0, overlapStart - start));
    if (overlapStart < overlapEnd) {
      const marks = (run.marks ?? []).filter((entry) => entry.type !== mark.type);
      if (!remove) marks.push(structuredClone(mark));
      runs.push({
        text: run.text.slice(overlapStart - start, overlapEnd - start),
        ...(marks.length ? { marks } : {}),
      });
    }
    if (overlapEnd < end) runs.push(copyRunSlice(run, overlapEnd - start, run.text.length));
  });
  return { runs: normalizeRuns(runs) };
}

export function setRichTextMark(
  value: RichTextValue,
  range: TextRange,
  mark: RichTextMark,
): RichTextValue {
  return transformSelectedMarks(value, range, (marks) => [
    ...marks.filter((entry) => entry.type !== mark.type),
    structuredClone(mark),
  ]);
}

export function removeRichTextMark(
  value: RichTextValue,
  range: TextRange,
  type: RichTextMark["type"],
): RichTextValue {
  return transformSelectedMarks(
    value,
    range,
    (marks) => marks.filter((entry) => entry.type !== type),
  );
}

function transformSelectedMarks(
  value: RichTextValue,
  range: TextRange,
  update: (marks: RichTextMark[]) => RichTextMark[],
): RichTextValue {
  const length = richTextPlainText(value).length;
  const normalized = normalizeRange(length, range);
  if (normalized.start === normalized.end) return structuredClone(value);
  let offset = 0;
  const runs: RichTextRun[] = [];
  value.runs.forEach((run) => {
    const start = offset;
    const end = start + run.text.length;
    offset = end;
    const overlapStart = Math.max(start, normalized.start);
    const overlapEnd = Math.min(end, normalized.end);
    if (start < overlapStart) runs.push(copyRunSlice(run, 0, overlapStart - start));
    if (overlapStart < overlapEnd) {
      const marks = update(structuredClone(run.marks ?? []));
      runs.push({
        text: run.text.slice(overlapStart - start, overlapEnd - start),
        ...(marks.length ? { marks } : {}),
      });
    }
    if (overlapEnd < end) runs.push(copyRunSlice(run, overlapEnd - start, run.text.length));
  });
  return { runs: normalizeRuns(runs) };
}

function selectedRuns(value: RichTextValue, range: TextRange): RichTextRun[] {
  return sliceRichTextRuns(value, range.start, range.end).filter((run) => run.text.length > 0);
}

function sliceRichTextRuns(value: RichTextValue, from: number, to: number): RichTextRun[] {
  let offset = 0;
  const result: RichTextRun[] = [];
  value.runs.forEach((run) => {
    const start = offset;
    const end = start + run.text.length;
    offset = end;
    const sliceStart = Math.max(start, from);
    const sliceEnd = Math.min(end, to);
    if (sliceStart < sliceEnd) result.push(copyRunSlice(run, sliceStart - start, sliceEnd - start));
  });
  return result;
}

function marksAtOffset(value: RichTextValue, target: number): RichTextMark[] {
  let offset = 0;
  for (const run of value.runs) {
    const end = offset + run.text.length;
    if (target > offset && target <= end) return structuredClone(run.marks ?? []);
    if (target === offset && run.text.length > 0) return structuredClone(run.marks ?? []);
    offset = end;
  }
  return [];
}

function copyRunSlice(run: RichTextRun, start: number, end: number): RichTextRun {
  return {
    text: run.text.slice(start, end),
    ...(run.marks?.length ? { marks: structuredClone(run.marks) } : {}),
  };
}

function normalizeRuns(runs: RichTextRun[]): RichTextRun[] {
  const result: RichTextRun[] = [];
  runs.filter((run) => run.text.length > 0).forEach((run) => {
    const previous = result.at(-1);
    if (previous && sameMarks(previous.marks, run.marks)) previous.text += run.text;
    else result.push(structuredClone(run));
  });
  return result.length ? result : [{ text: "" }];
}

function sameMarks(left: RichTextMark[] | undefined, right: RichTextMark[] | undefined): boolean {
  return JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
}

function normalizeRange(length: number, range: TextRange): TextRange {
  const start = Math.max(0, Math.min(length, Math.min(range.start, range.end)));
  const end = Math.max(start, Math.min(length, Math.max(range.start, range.end)));
  return { start, end };
}

function requireActiveProp(
  document: DocumentData,
  componentId: string,
  propId: string,
): ComponentPropDefinition {
  const prop = document.components[componentId]?.propDefinitions.find((entry) => entry.id === propId);
  if (!prop) throw new Error(`component prop을 찾을 수 없습니다: ${propId}`);
  if (prop.status !== "active") throw new Error("보관된 component prop은 직접 편집할 수 없습니다.");
  return prop;
}

function directValue(value: ComponentPropValue): DirectEditValue {
  if (typeof value === "string" || isRichTextValue(value)) return structuredClone(value);
  throw new Error("직접 편집할 수 없는 component prop type입니다.");
}

function isRichTextValue(value: unknown): value is RichTextValue {
  return typeof value === "object" && value !== null && "runs" in value;
}
