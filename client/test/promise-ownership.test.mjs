import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { ESLint } from 'eslint';
import { resolve } from 'node:path';

const harness = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {useGenericDocumentSession} from './src/renderer/src/pages/document-editor/useGenericDocumentSession.ts';
import {createEmptyDocument} from './src/foundation/document.ts';
import {runAction} from './src/renderer/src/shared/lib/async-errors.ts';
import {toast} from './src/renderer/src/shared/ui/toast.tsx';
const w=window;
w.notices=[];const add=toast.add;toast.add=event=>{w.notices.push(event);return add(event)};w.runAction=runAction;
const initial=createEmptyDocument({documentId:'probe',name:'Before',createId:p=>p+'-probe'});
w.documents={reportEditorContext(){},saveDocument(){return new Promise((resolve,reject)=>{w.resolveSave=resolve;w.rejectSave=reject;});}};
const onSummary=()=>{};
function Harness(){w.session=useGenericDocumentSession(initial,onSummary,'initial');return <output>{w.session.document.name}</output>;}
createRoot(document.getElementById('root')).render(<Harness/>);
`;

test('delayed save gates follow-up; rejection preserves dirty state and retry', async () => {
  const bundle = await build({ stdin: { contents: harness, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', jsx: 'automatic', alias: { '@': resolve('src/renderer/src') }, define: { 'process.env.NODE_ENV': '"development"' } });
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined), headless: true });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.waitForFunction(() => !!window.session);
    await page.evaluate(() => {
      window.session.updateDocument(d => ({ ...d, name: 'Draft' }));
      window.closedAfterSave = false;
      window.saveResult = undefined;
      window.session.saveUntilClean().then(ok => { window.saveResult = ok; if (ok) window.closedAfterSave = true; });
    });
    assert.equal(await page.evaluate(() => window.closedAfterSave), false);
    await page.evaluate(() => window.rejectSave(new Error('injected save failure')));
    await page.waitForFunction(() => window.saveResult === false);
    assert.deepEqual(await page.evaluate(() => ({ name: window.session.getCurrentDocument().name, closed: window.closedAfterSave, state: window.session.saveStateStore.getSnapshot().type })), { name: 'Draft', closed: false, state: 'error' });
    await page.evaluate(() => { window.saveResult = undefined; window.session.saveUntilClean().then(ok => { window.saveResult = ok; window.closedAfterSave = ok; }); });
    assert.equal(await page.evaluate(() => window.closedAfterSave), false);
    await page.evaluate(() => window.resolveSave({ summary: { id: 'probe', name: 'Draft', updatedAt: 'now' }, revision: 'next' }));
    await page.waitForFunction(() => window.saveResult === true);
    assert.equal(await page.evaluate(() => window.closedAfterSave), true);
    assert.equal(await page.evaluate(() => window.session.saveStateStore.getSnapshot().type), 'saved');
    await page.evaluate(() => window.runAction(Promise.reject(new Error('detached failure'))));
    await page.waitForFunction(() => window.notices.length === 1);
    assert.equal(await page.evaluate(() => window.notices[0].description), 'detached failure');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('typed lint rejects floating, void and async void-callback misuse', async () => {
  // Real project input keeps type resolution identical to product lint.
  const { writeFileSync, unlinkSync } = await import('node:fs');
  const file = 'src/foundation/promise-probe.ts';
  writeFileSync(file, 'Promise.resolve();\nvoid Promise.resolve();\n[1].forEach(async () => {});\nPromise.resolve().catch((_error: unknown): void => {});\n');
  try {
    const actual = new ESLint();
    const [result] = await actual.lintFiles([file]);
    assert.equal(result.messages.filter(m => m.ruleId === '@typescript-eslint/no-floating-promises').length, 2);
    assert.equal(result.messages.filter(m => m.ruleId === '@typescript-eslint/no-misused-promises').length, 1);
  } finally { unlinkSync(file); }
});

test('real preload close listener waits, and reports false/rejection', async () => {
  const { runInNewContext } = await import('node:vm');
  const bundle = await build({ entryPoints: ['src/preload/index.ts'], bundle: true, platform: 'node', format: 'cjs', external: ['electron'], write: false });
  let api; let listener; const sent = [];
  const ipc = { invoke: async () => undefined, on: (_channel, fn) => { listener = fn; }, send: (...args) => sent.push(args), removeListener() {} };
  runInNewContext(bundle.outputFiles[0].text, { require: () => ({ contextBridge: { exposeInMainWorld: (_name, value) => { api = value; } }, ipcRenderer: ipc }), exports: {}, module: { exports: {} } });
  let resolveSave;
  api.onBeforeClose(() => new Promise(resolve => { resolveSave = resolve; }));
  listener(); const baseline = sent.length;
  await new Promise(setImmediate); assert.equal(sent.length, baseline);
  resolveSave(true); await new Promise(setImmediate); assert.equal(sent.at(-1)[1], true);
  api.onBeforeClose(async () => false); listener(); await new Promise(setImmediate); assert.equal(sent.at(-1)[1], false);
  api.onBeforeClose(async () => { throw new Error('injected'); }); listener(); await new Promise(setImmediate); assert.equal(sent.at(-1)[1], false);
});
