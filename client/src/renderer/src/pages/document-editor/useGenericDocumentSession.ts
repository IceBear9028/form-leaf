import { flushMarkdownEditing, getMarkdownEditorPin, reconcileMarkdownDocumentUpdate } from "./markdown/editor/markdownEditorLifecycle.ts";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { registerAgentEditor } from "./agentEditorBridge.ts";
import type { EditorContext } from "../../../../foundation/documentSessionProtocol.ts";
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
  initialRevision?: string,
) {
  const expectedRevisionRef = useRef(initialRevision);
  const editorBusyRef = useRef(false);
  const selectionRef = useRef<DocumentSelection | undefined>(undefined);
  const leaseRef = useRef<string | undefined>(undefined);
  const [externalGeneration, setExternalGeneration] = useState(0);
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
    flushMarkdownEditing();
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
    const request = window.documents.saveDocument(current.documentId, current, expectedRevisionRef.current ?? "")
      .then(({ summary, revision }) => {
        expectedRevisionRef.current = revision;
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
    const next = reconcileMarkdownDocumentUpdate(typeof change === "function" ? change(current) : change);
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

  selectionRef.current = selection;
  useLayoutEffect(() => {
    if (!onSummaryChange) return;
    let composing = false;
    let overlay: HTMLDivElement | undefined;
    const root = globalThis.document.getElementById("root");
    const focusedEditor = () => !!globalThis.document.activeElement?.matches("input, textarea, select, [contenteditable=true]");
    const isEditing = () => composing || editorBusyRef.current || !!getMarkdownEditorPin() || focusedEditor();
    const context = (): EditorContext => ({
      documentId: documentRef.current.documentId, revision: expectedRevisionRef.current ?? "",
      hasUnsavedChanges: dirtyRef.current || !!inFlightSaveRef.current, isEditing: isEditing(),
      selection: selectionRef.current ? { target: selectionRef.current.editTarget ?? null, nodeId: selectionRef.current.nodeId } : null,
    });
    const release = () => {
      leaseRef.current = undefined;
      if (root) { root.inert = false; root.removeAttribute("aria-busy"); }
      overlay?.remove(); overlay = undefined;
    };
    const unregister = registerAgentEditor((request) => {
      const reply = (ok: boolean, leaseId?: string) => ({ requestId: request.requestId, ok, context: context(), ...(leaseId ? { leaseId } : {}) });
      if (request.documentId !== documentRef.current.documentId) return reply(true);
      if (request.type === "inspect") return reply(true);
      if (request.type === "release") {
        if (leaseRef.current === request.leaseId) release();
        return reply(true);
      }
      if (request.type === "acquire") {
        if (!root || leaseRef.current || dirtyRef.current || inFlightSaveRef.current || isEditing()) return reply(false);
        // Reserve synchronously before replying. Existing focus/composition always wins.
        // Inert prevents an edit from starting between the idle reply and durable commit.
        leaseRef.current = request.requestId;
        root.inert = true; root.setAttribute("aria-busy", "true");
        overlay = globalThis.document.createElement("div");
        overlay.role = "status";
        overlay.className = "fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-background px-4 py-2 text-sm shadow-lg";
        overlay.textContent = "에이전트 변경 적용 중…";
        globalThis.document.body.append(overlay);
        return reply(true, request.requestId);
      }
      if (request.leaseId !== leaseRef.current || dirtyRef.current || inFlightSaveRef.current || isEditing()) return reply(false);
      expectedRevisionRef.current = request.snapshot.revision;
      documentRef.current = request.snapshot.document;
      revisionRef.current += 1;
      flushSync(() => {
        setDocument(request.snapshot.document);
        setDocumentUpdate(fullDocumentUpdate(revisionRef.current));
        setSelection((current) => reconcileDocumentSelection(request.snapshot.document, current));
        setExternalGeneration((value) => value + 1);
      });
      saveStateStore.set({ type: "saved", at: request.snapshot.document.updatedAt });
      return reply(true);
    });
    const start = () => { composing = true; window.documents.reportEditorContext(context()); };
    const end = () => { composing = false; window.documents.reportEditorContext(context()); };
    globalThis.document.addEventListener("compositionstart", start, true);
    globalThis.document.addEventListener("compositionend", end, true);
    window.documents.reportEditorContext(context());
    const unsubscribe = saveStateStore.subscribe(() => window.documents.reportEditorContext(context()));
    return () => {
      unregister(); release(); unsubscribe();
      globalThis.document.removeEventListener("compositionstart", start, true);
      globalThis.document.removeEventListener("compositionend", end, true);
      window.documents.reportEditorContext(null);
    };
  }, [onSummaryChange, saveStateStore]);

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
    externalGeneration,
    setEditorBusy: (busy: boolean) => { editorBusyRef.current = busy; },
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
  }), [document, documentUpdate, externalGeneration, saveNow, saveStateStore, saveUntilClean, selection, updateDocument]);
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
