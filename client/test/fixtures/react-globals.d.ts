import type { AgentGrants } from '../../src/foundation/agentConnection.ts';
import type { DocumentSelection } from '../../src/renderer/src/pages/document-editor/documentSelection.ts';
import type { SaveStateStore } from '../../src/renderer/src/pages/document-editor/useGenericDocumentSession.ts';
import type { MarkdownEditorSnapshot } from '../../src/renderer/src/pages/document-editor/markdown/editor/MarkdownEditorSession.ts';
declare global {
  interface Window {
    reactProbeMode: 'grants' | 'session' | 'host' | 'buffer' | 'drag';
    patchGrants: (patch: Partial<AgentGrants>) => void;
    nextConnection: () => void;
    revokeConnection: () => void;
    grantDirty: boolean;
    grantSaves: AgentGrants[];
    saveSucceeds: boolean;
    probeReady: boolean;
    probeSelected: string | undefined;
    rememberStore: () => void;
    sameStore: () => boolean;
    probeSelection: (selection?: DocumentSelection) => void;
    probeStore: SaveStateStore;
    armOwner: () => void;
    ownerFlushes: number;
    ownerCloses: number;
    hideProbe: () => void;
    rerenderHost: () => void;
    hostSnapshots: MarkdownEditorSnapshot[];
    bufferStep: () => void;
    bufferLatestFlush: () => void;
    bufferCancel: () => void;
    bufferRemote: (value: string) => void;
    bufferPublishes: Array<{ value: string; version: number }>;
    dragChanges: number[];
    rerenderDrag: () => void;
  }
}
