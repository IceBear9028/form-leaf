import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DocumentData } from "../../../../foundation/documentModel.ts";
import type { DocumentSummary } from "../../../../foundation/documentLibrary.ts";
import {
  reconcileDocumentSelection,
  type DocumentSelection,
} from "./documentSelection.ts";

export type SaveState =
  | { type: "dirty" }
  | { type: "saving" }
  | { type: "saved"; at: string }
  | { type: "error"; message: string };

export type GenericDocumentChange =
  | DocumentData
  | ((current: DocumentData) => DocumentData);

export function useGenericDocumentSession(
  initialDocument: DocumentData,
  onSummaryChange?: (summary: DocumentSummary) => void,
) {
  const [document, setDocument] = useState(initialDocument);
  const [selection, setSelection] = useState<DocumentSelection>();
  const [saveState, setSaveState] = useState<SaveState>({ type: "saved", at: initialDocument.updatedAt });
  const [exportedPath, setExportedPath] = useState<string | null>(null);
  const documentRef = useRef(initialDocument);
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
      setSaveState({ type: "saved", at: new Date().toISOString() });
      return true;
    }
    if (inFlightSaveRef.current) {
      const completed = await inFlightSaveRef.current;
      if (!completed) return false;
    }
    if (!dirtyRef.current) return true;

    const current = documentRef.current;
    dirtyRef.current = false;
    setSaveState({ type: "saving" });
    const request = window.documents.saveDocument(current.documentId, current)
      .then((summary) => {
        onSummaryChange(summary);
        setSaveState(dirtyRef.current ? { type: "dirty" } : { type: "saved", at: summary.updatedAt });
        return true;
      })
      .catch((error: unknown) => {
        dirtyRef.current = true;
        setSaveState({ type: "error", message: errorMessage(error) });
        return false;
      });
    inFlightSaveRef.current = request;
    const completed = await request;
    if (inFlightSaveRef.current === request) inFlightSaveRef.current = undefined;
    return completed;
  }, [onSummaryChange]);

  const saveUntilClean = useCallback(async (): Promise<boolean> => {
    let saved = await saveNow();
    if (saved && dirtyRef.current) saved = await saveNow();
    return saved;
  }, [saveNow]);

  const updateDocument = useCallback((change: GenericDocumentChange) => {
    const current = documentRef.current;
    const next = typeof change === "function" ? change(current) : change;
    documentRef.current = next;
    setDocument(next);
    setExportedPath(null);
    dirtyRef.current = true;
    setSaveState({ type: "dirty" });
    if (!onSummaryChange) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => void saveNow(), 650);
  }, [onSummaryChange, saveNow]);

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
    selection,
    dirty: saveState.type === "dirty" || saveState.type === "error",
    saveState,
    exportedPath,
    updateDocument,
    setSelection,
    saveNow,
    saveUntilClean,
    setExportedPath,
    setSaveError: (message: string) => setSaveState({ type: "error", message }),
    markSaved: () => {
      dirtyRef.current = false;
      setSaveState({ type: "saved", at: new Date().toISOString() });
    },
  }), [document, exportedPath, saveNow, saveState, saveUntilClean, selection, updateDocument]);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
