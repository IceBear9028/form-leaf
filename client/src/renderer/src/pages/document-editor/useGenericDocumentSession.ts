import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DocumentData } from "../../../../foundation/documentModel.ts";
import type { DocumentSummary } from "../../../../foundation/documentLibrary.ts";
import {
  fullDocumentUpdate,
  inferDocumentUpdateOperations,
  type DocumentUpdate,
  type DocumentUpdateOperation,
} from "../../../../foundation/documentUpdates.ts";
import {
  reconcileDocumentSelection,
  type DocumentSelection,
} from "./documentSelection.ts";

export type SaveState =
  | { type: "dirty" }
  | { type: "saving" }
  | { type: "saved"; at: string }
  | { type: "error"; message: string };

export type SaveStateStore = {
  getSnapshot: () => SaveState;
  subscribe: (listener: () => void) => () => void;
  set: (state: SaveState) => void;
};

export type GenericDocumentChange =
  | DocumentData
  | ((current: DocumentData) => DocumentData);

export function useGenericDocumentSession(
  initialDocument: DocumentData,
  onSummaryChange?: (summary: DocumentSummary) => void,
) {
  const [document, setDocument] = useState(initialDocument);
  const [documentUpdate, setDocumentUpdate] = useState<DocumentUpdate>(() => fullDocumentUpdate(0));
  const [selection, setSelection] = useState<DocumentSelection>();
  const saveStateStoreRef = useRef<SaveStateStore | undefined>(undefined);
  if (!saveStateStoreRef.current) {
    saveStateStoreRef.current = createSaveStateStore({ type: "saved", at: initialDocument.updatedAt });
  }
  const saveStateStore = saveStateStoreRef.current;
  const exportedPathRef = useRef<string | null>(null);
  const documentRef = useRef(initialDocument);
  const revisionRef = useRef(0);
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<number | undefined>(undefined);
  const inFlightSaveRef = useRef<Promise<boolean> | undefined>(undefined);

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = undefined;
    }
    if (!onSummaryChange) {
      dirtyRef.current = false;
      saveStateStore.set({ type: "saved", at: new Date().toISOString() });
      return true;
    }
    if (inFlightSaveRef.current) {
      const completed = await inFlightSaveRef.current;
      if (!completed) return false;
    }
    if (!dirtyRef.current) return true;

    const current = documentRef.current;
    dirtyRef.current = false;
    saveStateStore.set({ type: "saving" });
    const request = window.documents.saveDocument(current.documentId, current)
      .then((summary) => {
        onSummaryChange(summary);
        saveStateStore.set(dirtyRef.current ? { type: "dirty" } : { type: "saved", at: summary.updatedAt });
        return true;
      })
      .catch((error: unknown) => {
        dirtyRef.current = true;
        saveStateStore.set({ type: "error", message: errorMessage(error) });
        return false;
      });
    inFlightSaveRef.current = request;
    const completed = await request;
    if (inFlightSaveRef.current === request) inFlightSaveRef.current = undefined;
    return completed;
  }, [onSummaryChange, saveStateStore]);

  const saveUntilClean = useCallback(async (): Promise<boolean> => {
    let saved = await saveNow();
    if (saved && dirtyRef.current) saved = await saveNow();
    return saved;
  }, [saveNow]);

  const updateDocument = useCallback((
    change: GenericDocumentChange,
    operations?: readonly DocumentUpdateOperation[],
  ) => {
    const current = documentRef.current;
    const next = typeof change === "function" ? change(current) : change;
    if (next === current) return;
    revisionRef.current += 1;
    documentRef.current = next;
    setDocument(next);
    const inferredOperations = operations ?? inferDocumentUpdateOperations(current, next);
    setDocumentUpdate(inferredOperations.length
      ? { revision: revisionRef.current, operations: inferredOperations }
      : fullDocumentUpdate(revisionRef.current));
    exportedPathRef.current = null;
    dirtyRef.current = true;
    saveStateStore.set({ type: "dirty" });
    if (!onSummaryChange) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => void saveNow(), 650);
  }, [onSummaryChange, saveNow, saveStateStore]);

  useEffect(() => {
    setSelection((current) => reconcileDocumentSelection(document, current));
  }, [document]);

  useEffect(() => () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveNow();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveNow]);

  return useMemo(() => ({
    document,
    documentUpdate,
    selection,
    saveStateStore,
    updateDocument,
    setSelection,
    saveNow,
    saveUntilClean,
    getCurrentDocument: () => documentRef.current,
    setExportedPath: (path: string | null) => {
      exportedPathRef.current = path;
    },
    setSaveError: (message: string) => saveStateStore.set({ type: "error", message }),
    markSaved: () => {
      dirtyRef.current = false;
      saveStateStore.set({ type: "saved", at: new Date().toISOString() });
    },
  }), [document, documentUpdate, saveNow, saveStateStore, saveUntilClean, selection, updateDocument]);
}

export function createSaveStateStore(initialState: SaveState): SaveStateStore {
  let state = initialState;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (next) => {
      if (sameSaveState(state, next)) return;
      state = next;
      listeners.forEach((listener) => listener());
    },
  };
}

function sameSaveState(left: SaveState, right: SaveState): boolean {
  if (left.type !== right.type) return false;
  if (left.type === "saved" && right.type === "saved") return left.at === right.at;
  if (left.type === "error" && right.type === "error") return left.message === right.message;
  return true;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
