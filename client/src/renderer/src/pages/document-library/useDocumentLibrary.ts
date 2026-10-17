import { useCallback, useEffect, useState } from "react";
import type { WorkspaceDocument } from "../../../../foundation/document";
import {
  sortDeletedDocumentSummaries,
  sortDocumentSummaries,
  type DeletedDocumentSummary,
  type DocumentSummary,
} from "../../../../foundation/documentLibrary";

export function useDocumentLibrary() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [deletedDocuments, setDeletedDocuments] = useState<DeletedDocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(undefined);
    try {
      const [active, deleted] = await Promise.all([
        window.documents.listDocuments(),
        window.documents.listDeletedDocuments(),
      ]);
      setDocuments(sortDocumentSummaries(active));
      setDeletedDocuments(sortDeletedDocumentSummaries(deleted));
      return true;
    } catch (loadError) {
      setError(errorMessage(loadError));
      return false;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (): Promise<WorkspaceDocument | undefined> => {
    if (busyId) return undefined;
    setBusyId("create");
    setError(undefined);
    try {
      const created = await window.documents.createDocument();
      setDocuments((current) => sortDocumentSummaries([...current, created.summary]));
      return created.document;
    } catch (createError) {
      setError(errorMessage(createError));
      return undefined;
    } finally {
      setBusyId(undefined);
    }
  };

  const open = async (id: string): Promise<WorkspaceDocument | undefined> => {
    if (busyId) return undefined;
    setBusyId(id);
    setError(undefined);
    try {
      return await window.documents.loadDocument(id);
    } catch (openError) {
      setError(errorMessage(openError));
      return undefined;
    } finally {
      setBusyId(undefined);
    }
  };

  const rename = async (id: string, title: string): Promise<boolean> => {
    if (busyId) return false;
    setBusyId(id);
    setError(undefined);
    try {
      updateSummary(await window.documents.renameDocument(id, title));
      return true;
    } catch (renameError) {
      setError(errorMessage(renameError));
      return false;
    } finally {
      setBusyId(undefined);
    }
  };

  const moveToTrash = async (id: string): Promise<boolean> => {
    if (busyId) return false;
    setBusyId(id);
    setError(undefined);
    try {
      await window.documents.deleteDocument(id);
      await load(false);
      return true;
    } catch (deleteError) {
      setError(errorMessage(deleteError));
      return false;
    } finally {
      setBusyId(undefined);
    }
  };

  const restore = async (id: string): Promise<boolean> => {
    if (busyId) return false;
    setBusyId(id);
    setError(undefined);
    try {
      await window.documents.restoreDocument(id);
      await load(false);
      return true;
    } catch (restoreError) {
      setError(errorMessage(restoreError));
      return false;
    } finally {
      setBusyId(undefined);
    }
  };

  const permanentlyDelete = async (id: string): Promise<boolean> => {
    if (busyId) return false;
    setBusyId(id);
    setError(undefined);
    try {
      await window.documents.permanentlyDeleteDocument(id);
      await load(false);
      return true;
    } catch (deleteError) {
      setError(errorMessage(deleteError));
      return false;
    } finally {
      setBusyId(undefined);
    }
  };

  const updateSummary = useCallback((summary: DocumentSummary) => {
    setDocuments((current) => sortDocumentSummaries(current.map((item) =>
      item.id === summary.id ? summary : item,
    )));
  }, []);

  return {
    documents,
    deletedDocuments,
    loading,
    busyId,
    error,
    load,
    create,
    open,
    rename,
    moveToTrash,
    restore,
    permanentlyDelete,
    updateSummary,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
