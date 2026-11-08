import { createElement as h, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { AgentConnection, AgentGrants } from '../../src/foundation/agentConnection.ts';
import type { DocumentApi } from '../../src/foundation/documentLibrary.ts';
import { createEmptyDocument, addNode } from '../../src/foundation/document.ts';
import { GrantEditor } from '../../src/renderer/src/pages/agent-settings/AgentConnectionDetail.tsx';
import { GenericDocumentEditorPage } from '../../src/renderer/src/pages/document-editor/GenericDocumentEditorPage.tsx';
import { MarkdownEditorHost } from '../../src/renderer/src/pages/document-editor/markdown/editor/MarkdownEditorHost.tsx';
import { beginMarkdownBlock, registerMarkdownOwner } from '../../src/renderer/src/pages/document-editor/markdown/editor/markdownEditorLifecycle.ts';
import { useBufferedStringEdit } from '../../src/renderer/src/pages/document-editor/rendering/useBufferedEditValue.ts';
import { TooltipProvider } from '../../src/renderer/src/shared/ui/tooltip.tsx';
import { DocumentRenderer } from '../../src/renderer/src/pages/document-editor/rendering/DocumentRenderer.tsx';
import { ComponentDirectManipulationOverlay } from '../../src/renderer/src/pages/document-editor/ComponentDirectManipulationOverlay.tsx';
import type { GenericDocumentChange } from '../../src/renderer/src/pages/document-editor/useGenericDocumentSession.ts';

const initialGrants: AgentGrants = { documentIds: ['doc'], write: true, render: false, create: false, libraryRead: false };
window.grantSaves = []; window.saveSucceeds = false;
const onDirtyChange = (dirty: boolean) => { window.grantDirty = dirty; };
function Grants() {
  const [connection, setConnection] = useState<AgentConnection>({ id: 'first', name: 'Test', grants: initialGrants, revoked: false, createdAt: '2026-11-08' });
  window.patchGrants = patch => setConnection(current => ({ ...current, grants: { ...current.grants, ...patch } }));
  window.nextConnection = () => setConnection({ ...connection, id: 'second', grants: initialGrants });
  window.revokeConnection = () => setConnection(current => ({ ...current, revoked: true }));
  const onSave = async (grants: AgentGrants) => { window.grantSaves.push(grants); if (window.saveSucceeds) setConnection(current => ({ ...current, grants })); return window.saveSucceeds; };
  return h(GrantEditor, { key: connection.id, connection, documents: [{ id: 'doc', name: 'Test document', createdAt: 'now', updatedAt: 'now' }], busy: false, onSave, onDirtyChange });
}
let nextId = 0;
let document = createEmptyDocument({ documentId: 'probe', name: 'Probe', createId: prefix => prefix + '-' + nextId++ });
document = addNode(document, document.rootNodeId, { id: 'text', name: 'Text', type: 'markdown', source: '초안', visible: true });
document = addNode(document, document.rootNodeId, { id: 'other', name: 'Other', type: 'text', value: 'Other', visible: true });
window.ownerFlushes = 0; window.ownerCloses = 0;
window.armOwner = () => {
  beginMarkdownBlock({ kind: 'node', nodeId: 'text' }, '초안', 0);
  registerMarkdownOwner({ flush: () => { window.ownerFlushes++; }, close: () => { window.ownerCloses++; } });
};
const api: Pick<DocumentApi, 'onBeforeClose' | 'listComponents' | 'reportEditorContext'> = { onBeforeClose: () => () => {}, listComponents: async () => [], reportEditorContext: () => {} };
// @ts-expect-error -- The isolated editor harness implements only the bridge methods exercised here.
window.documents = api;
window.hostSnapshots = [];
function Host() {
  const [, setTick] = useState(0);
  const [activation] = useState(() => ({ markdown: '경쟁: ', textOffset: 4, onSnapshot: (snapshot: Parameters<typeof window.hostSnapshots.push>[0]) => { window.hostSnapshots.push(snapshot); }, onClose: () => {} }));
  window.rerenderHost = () => setTick(value => value + 1);
  return h(MarkdownEditorHost, { activation });
}
window.bufferPublishes = [];
function Buffer() {
  const [external, setExternal] = useState('가');
  const [version, setVersion] = useState(0);
  const buffer = useBufferedStringEdit(external, value => { window.bufferPublishes.push({ value, version }); });
  window.bufferRemote = setExternal;
  window.bufferStep = () => { buffer.update('가나다', { start: 3, end: 3 }); setExternal('가나'); };
  window.bufferLatestFlush = () => { buffer.update('최신', { start: 2, end: 2 }); flushSync(() => setVersion(value => value + 1)); buffer.flush(); };
  window.bufferCancel = () => { buffer.update('취소', { start: 2, end: 2 }); window.hideProbe(); };
  return h('output', null, buffer.value);
}
window.dragChanges = [];
function Drag() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(document);
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  const [version, setVersion] = useState(0);
  const onChange = (change: GenericDocumentChange) => { window.dragChanges.push(version); setDraft(current => typeof change === 'function' ? change(current) : change); };
  window.rerenderDrag = () => setVersion(value => value + 1);
  return h('div', { ref: canvasRef, id: 'drag-' + version, style: { position: 'relative', width: 600 } },
    h(DocumentRenderer, { document: draft }),
    ready && h(ComponentDirectManipulationOverlay, { canvasRef, document: draft, selection: { kind: 'node', nodeId: 'text' }, componentRootNodeId: draft.rootNodeId, onSelectionChange: () => {}, onChange }));
}
function Session() {
  useEffect(() => { window.probeReady = true; }, []);
  return h(GenericDocumentEditorPage, { initialDocument: document, initialRevision: 'probe', onSummaryChange: () => {}, onBack: async () => {} });
}
let rememberedStore: typeof window.probeStore | undefined;
window.rememberStore = () => { rememberedStore = window.probeStore; };
window.sameStore = () => rememberedStore === window.probeStore;
const element = globalThis.document.getElementById('root');
if (!element) throw new Error('probe root missing');
const root = createRoot(element);
window.hideProbe = () => flushSync(() => root.unmount());
const mode = window.reactProbeMode;
root.render(h(TooltipProvider, null, mode === 'grants' ? h(Grants) : mode === 'host' ? h(Host) : mode === 'buffer' ? h(Buffer) : mode === 'drag' ? h(Drag) : h(Session)));
