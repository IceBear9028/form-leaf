import { applyNodeOperation, NODE_OPERATIONS } from "./nodeOperations.ts";
import type { DocumentData } from "../../foundation/documentModel.ts";
import { updateDocumentEditValue, documentEditTargetKey } from "../../foundation/documentEditing.ts";
import { readEditTarget } from "../../foundation/documentCommandTargets.ts";
import { failure, CommandFailure, type Operation, type OperationResult } from "../../foundation/documentCommands.ts";
import { assertDocumentData } from "../../foundation/documentValidation.ts";
import type { Mutation } from "./documentService.ts";

export const AVAILABLE_OPERATIONS: Operation["type"][] = ["set_edit_value", "replace_text", ...NODE_OPERATIONS];
export function applyDocumentOperations(document: DocumentData, operations: Operation[]): Mutation {
  let next = structuredClone(document);
  const affectedNodeIds = new Set<string>();
  const affectedTargets = new Map<string, Extract<Operation, { type: "set_edit_value" }>["target"]>();
  const results: OperationResult[] = [];
  for (const [operationIndex, operation] of operations.entries()) {
    try {
      const step = applyNodeOperation(next, operation);
      if (step) {
        next = step.document;
        step.nodeIds.forEach((id) => affectedNodeIds.add(id));
        results.push({ operationIndex, type: operation.type, ...(step.created ? { created: step.created } : {}), ...(step.idMap ? { idMap: step.idMap } : {}) });
        continue;
      }
      if (operation.type !== "set_edit_value" && operation.type !== "replace_text") failure("UNSUPPORTED_OPERATION", "이 변경 명령은 아직 제공하지 않습니다.");
      const current = readEditTarget(next, operation.target);
      let value;
      if (operation.type === "set_edit_value") {
        value = operation.value;
        if ((current.valueType === "rich-text") !== (typeof value !== "string")) failure("VALIDATION_FAILED", "값의 유형이 대상의 선언 유형과 다릅니다.");
      } else {
        if (typeof current.value !== "string" || current.valueType === "rich-text") failure("UNSUPPORTED_OPERATION", "부분 문자열 변경은 text와 Markdown만 지원합니다.");
        const first = current.value.indexOf(operation.oldText);
        if (first < 0) failure("TEXT_NOT_FOUND", "변경할 문자열이 없습니다. 현재 값을 다시 읽으세요.");
        if (current.value.indexOf(operation.oldText, first + 1) >= 0) failure("AMBIGUOUS_TEXT", "변경할 문자열이 여러 번 나타납니다. 더 긴 고유 문자열을 지정하세요.");
        value = current.value.slice(0, first) + operation.newText + current.value.slice(first + operation.oldText.length);
        if (value.length > 100_000) failure("VALIDATION_FAILED", "변경 결과가 문자열 길이 한도를 초과합니다.");
      }
      // Canonical strings never pass through the editor codec.
      next = updateDocumentEditValue(next, operation.target, value, { now: () => document.updatedAt });
      affectedNodeIds.add(current.nodeId);
      affectedTargets.set(documentEditTargetKey(operation.target), operation.target);
      results.push({ operationIndex, type: operation.type });
    } catch (error) {
      if (error instanceof CommandFailure) throw error;
      failure("VALIDATION_FAILED", `명령 ${operationIndex + 1}의 값 또는 참조가 올바르지 않습니다.`);
    }
  }
  try { assertDocumentData(next); }
  catch { failure("VALIDATION_FAILED", "변경 후 문서 구조·값·참조가 올바르지 않습니다."); }
  return { document: next, changes: { affectedNodeIds: [...affectedNodeIds], affectedTargets: [...affectedTargets.values()], removedItemIds: [], summary: `${operations.length}개 변경 명령 적용` }, results, warnings: [] };
}
