import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { useGenericDocumentSession } from '../../src/renderer/src/pages/document-editor/useGenericDocumentSession.ts';
import { createEmptyDocument } from '../../src/foundation/document.ts';
import { runAction } from '../../src/renderer/src/shared/lib/async-errors.ts';
import { toast } from '../../src/renderer/src/shared/ui/toast.tsx';
import type { DocumentApi } from '../../src/foundation/documentLibrary.ts';
import type { SaveDocumentResult } from '../../src/foundation/documentSessionProtocol.ts';

window.notices = [];
const add = toast.add;
toast.add = event => {
  window.notices.push({ description: typeof event.description === 'string' ? event.description : undefined });
  return add(event);
};
window.runAction = runAction;
const initial = createEmptyDocument({ documentId: 'probe', name: 'Before', createId: prefix => prefix + '-probe' });
const documents: Pick<DocumentApi, 'reportEditorContext' | 'saveDocument'> = {
  reportEditorContext() {},
  saveDocument(): Promise<SaveDocumentResult> {
    return new Promise((resolve, reject) => { window.resolveSave = resolve; window.rejectSave = reject; });
  },
};
// @ts-expect-error -- This isolated session mock implements only the APIs exercised by the hook.
window.documents = documents;
const onSummary = () => {};
function Harness() {
  const session = useGenericDocumentSession(initial, onSummary, 'initial');
  window.session = session;
  return createElement('output', null, session.document.name);
}
const root = document.getElementById('root');
if (!root) throw new Error('test root missing');
createRoot(root).render(createElement(Harness));
