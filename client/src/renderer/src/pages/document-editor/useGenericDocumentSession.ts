import { useCallback, useEffect, useMemo, useState } from "react";
import type { DocumentData } from "../../../../foundation/documentModel.ts";
import {
  reconcileDocumentSelection,
  type DocumentSelection,
} from "./documentSelection.ts";

export type GenericDocumentChange =
  | DocumentData
  | ((current: DocumentData) => DocumentData);

export function useGenericDocumentSession(initialDocument: DocumentData) {
  const [document, setDocument] = useState(initialDocument);
  const [selection, setSelection] = useState<DocumentSelection>();
  const [dirty, setDirty] = useState(false);

  const updateDocument = useCallback((change: GenericDocumentChange) => {
    setDocument((current) => typeof change === "function" ? change(current) : change);
    setDirty(true);
  }, []);

  useEffect(() => {
    setSelection((current) => reconcileDocumentSelection(document, current));
  }, [document]);

  return useMemo(() => ({
    document,
    selection,
    dirty,
    updateDocument,
    setSelection,
    markSaved: () => setDirty(false),
  }), [dirty, document, selection, updateDocument]);
}
