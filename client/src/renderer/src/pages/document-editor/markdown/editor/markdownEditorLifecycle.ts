import { documentEditTargetKey, readDocumentEditValue, updateDocumentEditValue, type DocumentEditTarget } from "../../../../../../foundation/documentEditing.ts";
import type { DocumentData } from "../../../../../../foundation/documentModel.ts";
import { createMarkdownEditorBlockSlice, replaceMarkdownEditorBlock, type MarkdownEditorBlockSlice } from "./markdownEditorBlockCodec.ts";

export type MarkdownEditorPin = { target: DocumentEditTarget; targetKey: string; source: string };
type ActiveOwner = { flush: () => void; close: () => void };

// The application has one active document and one keyboard editing owner.
// The pin keeps the original preview ranges stable until that target is left.
let pin: MarkdownEditorPin | undefined;
let currentSource = "";
let owner: ActiveOwner | undefined;
let deferredChange: { target: DocumentEditTarget; source: string } | undefined;
let published = new Set<string>();
const replacements = new Map<number, { originalEnd: number; markdown: string }>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
export const getMarkdownEditorPin = () => pin;
export const subscribeMarkdownEditor = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function beginMarkdownBlock(target: DocumentEditTarget, source: string, blockIndex: number) {
  const key = documentEditTargetKey(target);
  closeMarkdownBlock();
  if (pin?.targetKey !== key) {
    pin = { target, targetKey: key, source };
    currentSource = source;
    published = new Set([source]);
    replacements.clear();
    notify();
  }
  const original = createMarkdownEditorBlockSlice(pin.source, blockIndex);
  if (!original) return undefined;
  let start = original.range.start;
  for (const [offset, replacement] of replacements) {
    if (offset < original.range.start) start += replacement.markdown.length - (replacement.originalEnd - offset);
  }
  const markdown = replacements.get(original.range.start)?.markdown ?? original.markdown;
  const slice: MarkdownEditorBlockSlice = {
    source: currentSource, blockIndex, range: { start, end: start + markdown.length }, markdown,
  };
  return { slice, original };
}

export function publishMarkdownBlock(slice: MarkdownEditorBlockSlice, original: MarkdownEditorBlockSlice, markdown: string) {
  const result = replaceMarkdownEditorBlock(currentSource, slice, markdown);
  if (result.type === "applied") {
    currentSource = result.source;
    published.add(currentSource);
    replacements.set(original.range.start, { originalEnd: original.range.end, markdown });
  }
  return result;
}

export function registerMarkdownOwner(next: ActiveOwner) {
  owner = next;
  return () => { if (owner === next) owner = undefined; };
}
export function flushMarkdownEditing() { owner?.flush(); }
export function closeMarkdownBlock() {
  const previous = owner;
  if (!previous) return;
  previous.flush();
  owner = undefined;
  previous.close();
}
export function endMarkdownEditing() {
  closeMarkdownBlock();
  if (!pin) return;
  pin = undefined;
  replacements.clear();
  notify();
}

export function pinnedMarkdownDocument(document: DocumentData): DocumentData {
  if (!pin) return document;
  try { return updateDocumentEditValue(document, pin.target, pin.source); }
  catch { return document; }
}

export function reconcileMarkdownDocumentUpdate(document: DocumentData): DocumentData {
  if (!pin) return document;
  try {
    const value = readDocumentEditValue(document, pin.target);
    if (typeof value !== "string" || value === currentSource) return document;
    if (!published.has(value)) {
      owner?.flush();
      deferredChange = { target: pin.target, source: value };
      notify();
    }
    // Hold actual external replacements and old acknowledgements outside the view.
    return updateDocumentEditValue(document, pin.target, currentSource);
  } catch { endMarkdownEditing(); return document; }
}
export const getDeferredMarkdownSource = () => deferredChange?.source;
export const getDeferredMarkdownChange = () => deferredChange;
export function dismissDeferredMarkdownChange() { deferredChange = undefined; notify(); }

export function readPinnedMarkdownBlock(targetKey: string, blockIndex: number): string | undefined {
  if (pin?.targetKey !== targetKey) return undefined;
  const original = createMarkdownEditorBlockSlice(pin.source, blockIndex);
  return original ? replacements.get(original.range.start)?.markdown : undefined;
}
