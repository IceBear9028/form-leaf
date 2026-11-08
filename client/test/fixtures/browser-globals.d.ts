import type { useGenericDocumentSession } from '../../src/renderer/src/pages/document-editor/useGenericDocumentSession.ts';
import type { SaveDocumentResult } from '../../src/foundation/documentSessionProtocol.ts';
declare global {
  var openedPdf: string | undefined;
  var finishSaveDialog: ((result: import('electron').SaveDialogReturnValue) => void) | undefined;
  var loadReadyListeners: Array<Parameters<import('electron').IpcMain['on']>[1]> | undefined;

  interface Window {
    session: ReturnType<typeof useGenericDocumentSession>;
    resolveSave: (result: SaveDocumentResult) => void;
    rejectSave: (error: Error) => void;
    closedAfterSave: boolean;
    saveTask: Promise<void>;
    saveResult: boolean | undefined;
    runAction: (promise: Promise<unknown>) => void;
    notices: Array<{ description?: string }>;
    agentRoot: Element | null;
    agentEditorRoot: Element | null;
    loadEditor: Element | null;
    outputEditor: Element | null;
    ownershipRoot: Element | null;
    propEditorRoot: Element | null;
  }
}
