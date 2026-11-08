import { createElement as h, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { addComponentDefinition, createEmptyDocument } from '../../src/foundation/document.ts';
import type { DocumentApi } from '../../src/foundation/documentLibrary.ts';
import { ComponentReusePanel } from '../../src/renderer/src/pages/document-editor/ComponentReusePanel.tsx';
import { DocumentLibraryPage } from '../../src/renderer/src/pages/document-library/DocumentLibraryPage.tsx';
import { Label } from '../../src/renderer/src/shared/ui/label.tsx';
import { FieldLabel } from '../../src/renderer/src/shared/ui/field.tsx';
import { Input } from '../../src/renderer/src/shared/ui/input.tsx';
import { TooltipProvider } from '../../src/renderer/src/shared/ui/tooltip.tsx';

let sequence = 0;
let document = createEmptyDocument({ createId: prefix => `${prefix}-${sequence++}` });
document = addComponentDefinition(document, {
  id: 'card', name: 'Card', rootNodeId: 'card-root', propDefinitions: [],
}, {
  'card-root': { id: 'card-root', type: 'container', name: 'Card root', visible: true, childIds: [] },
});
const api: Pick<DocumentApi, 'listComponents'> = { listComponents: async () => [] };
// @ts-expect-error -- This isolated panel needs only the component list bridge.
window.documents = api;

function Harness() {
  const [name, setName] = useState('Rename fixture');
  const [renames, setRenames] = useState<Array<{ id: string; name: string }>>([]);
  return h(TooltipProvider, null,
    h(Label, { htmlFor: 'plain-input' }, 'Plain label'),
    h(Input, { id: 'plain-input' }),
    h(FieldLabel, { htmlFor: 'field-input' }, 'Field label'),
    h(Input, { id: 'field-input' }),
    h(ComponentReusePanel, { document, onSelectionChange: () => {}, onChange: () => {} }),
    h(DocumentLibraryPage, {
      documents: [{ id: 'rename', name, createdAt: '2026-11-08', updatedAt: '2026-11-08' }],
      deletedCount: 0, onCreate: async () => {}, onOpen: async () => {},
      onRename: async (id, nextName) => { setRenames(current => [...current, { id, name: nextName }]); setName(nextName); return true; },
      onDelete: async () => true, onOpenTrash: () => {}, onAgentSettings: () => {}, onRetry: () => {},
    }),
    h('output', { id: 'rename-log' }, JSON.stringify(renames)));
}
const root = globalThis.document.getElementById('root');
if (!root) throw new Error('Accessibility fixture root missing');
createRoot(root).render(h(Harness));
