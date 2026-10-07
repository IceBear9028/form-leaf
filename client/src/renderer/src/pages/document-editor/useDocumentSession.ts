import { useCallback, useEffect, useRef, useState } from "react";
import type { ResumeDocument } from "../../../../foundation/content/resume";
import type { DocumentSummary } from "../../../../foundation/documentLibrary";

export type SaveState =
  | { type: "dirty" }
  | { type: "saving" }
  | { type: "saved"; at: string }
  | { type: "error"; message: string };

type DocumentChange =
  | ResumeDocument
  | ((current: ResumeDocument) => ResumeDocument);

export function useDocumentSession(
  initialDocument: ResumeDocument,
  onSummaryChange: (summary: DocumentSummary) => void,
) {
  const [document, setDocument] = useState(initialDocument);
  const [saveState, setSaveState] = useState<SaveState>({
    type: "saved",
    at: initialDocument.updatedAt,
  });
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
        setSaveState(dirtyRef.current
          ? { type: "dirty" }
          : { type: "saved", at: summary.updatedAt });
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

  const updateDocument = (change: DocumentChange) => {
    const current = documentRef.current;
    const next = typeof change === "function" ? change(current) : change;
    documentRef.current = next;
    setDocument(next);
    setExportedPath(null);
    dirtyRef.current = true;
    setSaveState({ type: "dirty" });
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => void saveNow(), 650);
  };

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

  return {
    document,
    saveState,
    exportedPath,
    updateDocument,
    saveNow,
    saveUntilClean,
    setExportedPath,
    setSaveError: (message: string) => setSaveState({ type: "error", message }),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
