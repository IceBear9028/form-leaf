import * as Check from "./fixtures/assertions.ts";
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { ESLint } from 'eslint';
import { resolve } from 'node:path';


await test('delayed save gates follow-up; rejection preserves dirty state and retry', async () => {
  const bundle = await build({ entryPoints: ['test/fixtures/promise-harness.ts'], bundle: true, write: false, format: 'iife', jsx: 'automatic', alias: { '@': resolve('src/renderer/src') }, define: { 'process.env.NODE_ENV': '"development"' } });
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined), headless: true });
  try {
    const page = await browser.newPage();
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: Check.present(bundle.outputFiles[0], 'fixture value').text });
    await page.waitForFunction(() => !!window.session);
    await page.evaluate(() => {
      window.session.updateDocument(d => ({ ...d, name: 'Draft' }));
      window.closedAfterSave = false;
      window.saveResult = undefined;
      window.saveTask = window.session.saveUntilClean().then(ok => { window.saveResult = ok; if (ok) window.closedAfterSave = true; });
    });
    assert.equal(await page.evaluate(() => window.closedAfterSave), false);
    await page.evaluate(() => window.rejectSave(new Error('injected save failure')));
    await page.waitForFunction(() => window.saveResult === false);
    assert.deepEqual(await page.evaluate(() => ({ name: window.session.getCurrentDocument().name, closed: window.closedAfterSave, state: window.session.saveStateStore.getSnapshot().type })), { name: 'Draft', closed: false, state: 'error' });
    await page.evaluate(() => { window.saveResult = undefined; window.saveTask = window.session.saveUntilClean().then(ok => { window.saveResult = ok; window.closedAfterSave = ok; }); });
    assert.equal(await page.evaluate(() => window.closedAfterSave), false);
    await page.evaluate(() => window.resolveSave({ summary: { id: 'probe', name: 'Draft', updatedAt: 'now', createdAt: 'initial' }, revision: 'next' }));
    await page.waitForFunction(() => window.saveResult === true);
    assert.equal(await page.evaluate(() => window.closedAfterSave), true);
    assert.equal(await page.evaluate(() => window.session.saveStateStore.getSnapshot().type), 'saved');
    await page.evaluate(() => window.runAction(Promise.reject(new Error('detached failure'))));
    await page.waitForFunction(() => window.notices.length === 1);
    assert.equal(await page.evaluate(() => { const notice = window.notices[0]; if (!notice) throw new Error('missing error toast'); return notice.description; }), 'detached failure');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

await test('typed lint rejects floating, void and async void-callback misuse', async () => {
  // Real project input keeps type resolution identical to product lint.
  const { writeFileSync, unlinkSync } = await import('node:fs');
  const file = 'src/foundation/promise-probe.ts';
  writeFileSync(file, 'Promise.resolve();\nvoid Promise.resolve();\n[1].forEach(async () => {});\nPromise.resolve().catch((_error: unknown): void => {});\n');
  try {
    const actual = new ESLint();
    const [result] = await actual.lintFiles([file]);
    assert.equal(Check.present(result, 'fixture value').messages.filter(m => m.ruleId === '@typescript-eslint/no-floating-promises').length, 2);
    assert.equal(Check.present(result, 'fixture value').messages.filter(m => m.ruleId === '@typescript-eslint/no-misused-promises').length, 1);
  } finally { unlinkSync(file); }
});

await test('real preload close listener waits, and reports false/rejection', async () => {
  const { runInNewContext } = await import('node:vm');
  const bundle = await build({ entryPoints: ['src/preload/index.ts'], bundle: true, platform: 'node', format: 'cjs', external: ['electron'], write: false });
  let api: import("../src/foundation/documentLibrary.ts").DocumentApi | undefined; let listener: () => void = () => assert.fail("listener not registered"); const sent: unknown[][] = [];
  const ipc = { invoke: async () => undefined, on: (_channel: string, fn: () => void) => { listener = fn; }, send: (...args: unknown[]) => sent.push(args), removeListener() {} };
  runInNewContext(Check.present(bundle.outputFiles[0], 'fixture value').text, { require: () => ({ contextBridge: { exposeInMainWorld: (_name: string, value: import("../src/foundation/documentLibrary.ts").DocumentApi) => { api = value; } }, ipcRenderer: ipc }), exports: {}, module: { exports: {} } });
  assert.ok(api);
  let resolveSave: (value: boolean) => void = () => assert.fail("close handler did not start");
  api.onBeforeClose(() => new Promise(resolve => { resolveSave = resolve; }));
  listener(); const baseline = sent.length;
  await new Promise(setImmediate); assert.equal(sent.length, baseline);
  resolveSave(true); await new Promise(setImmediate); assert.equal(Check.present(sent.at(-1), 'fixture value')[1], true);
  api.onBeforeClose(async () => false); listener(); await new Promise(setImmediate); assert.equal(Check.present(sent.at(-1), 'fixture value')[1], false);
  api.onBeforeClose(async () => { throw new Error('injected'); }); listener(); await new Promise(setImmediate); assert.equal(Check.present(sent.at(-1), 'fixture value')[1], false);
});
