import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { chromium, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { present } from './fixtures/assertions.ts';

await test('React rules keep error/warning severity under the ESLint 10 compatibility adapter', async () => {
  const eslint = new ESLint({ overrideConfig: [{ files: ['src/renderer/**/*.{ts,tsx}'], languageOptions: { parserOptions: { project: false } }, rules: tseslint.configs.disableTypeChecked.rules }] });
  const [bad] = await eslint.lintText('import {useState} from "react"; export function Bad({flag}:{flag:boolean}) { if(flag) useState(0); return [<div id="a" id="b"/>, <input mystery="x"/>]; }', { filePath: 'src/renderer/src/react-probe.tsx' });
  const rules = new Set(present(bad, 'error fixture').messages.map(message => message.ruleId));
  for (const rule of ['react-hooks/rules-of-hooks', 'react/jsx-key', 'react/jsx-no-duplicate-props', 'react/no-unknown-property']) assert.ok(rules.has(rule), rule);
  const [warning] = await eslint.lintText('import {useEffect,useState} from "react"; export function Warning(){const [value,setValue]=useState(0);useEffect(()=>{setValue(1)},[]);return <div>{value}</div>}', { filePath: 'src/renderer/src/react-probe.tsx' });
  assert.equal(present(warning, 'warning fixture').errorCount, 0);
  assert.ok(present(warning, 'warning fixture').warningCount > 0);
});

await test('grants, session lifetime, composition, pending buffer and drag preserve their contracts', async () => {
  const bundle = await build({ entryPoints: ['test/fixtures/react-harness.ts'], outfile: '/tmp/formleaf-react-probe.js', bundle: true, write: false, format: 'iife', jsx: 'automatic', alias: { '@': resolve('src/renderer/src') }, define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'observe-session', setup(builder) {
    builder.onLoad({ filter: /GenericDocumentEditorPage\.tsx$/ }, async ({ path }) => ({ loader: 'tsx', contents: (await readFile(path, 'utf8')).replace('  const session = useGenericDocumentSession(initialDocument, onSummaryChange, initialRevision);', '  const session = useGenericDocumentSession(initialDocument, onSummaryChange, initialRevision);\n  window.probeSelection = session.setSelection; window.probeStore = session.saveStateStore; window.probeSelected = session.selection?.nodeId;') }));
  } }] });
  const js = present(bundle.outputFiles.find(file => file.path.endsWith('.js')), 'probe bundle').text;
  const css = bundle.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '';
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined), headless: true });
  const errors: string[] = [];
  const open = async (mode: Window['reactProbeMode']): Promise<Page> => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    page.setDefaultTimeout(8_000);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://formleaf.test/**', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto('http://formleaf.test/');
    await page.evaluate(value => { window.reactProbeMode = value; }, mode);
    await page.addStyleTag({ content: css + '\n[data-component-drag-handle]{position:absolute;pointer-events:auto}[role=switch]{display:inline-block;width:32px;height:20px}' });
    await page.addScriptTag({ content: js });
    if (errors.length) throw new Error(errors.join("\n"));
    return page;
  };
  try {
    const grants = await open('grants');
    const write = grants.getByRole('switch', { name: '허용 문서 수정' });
    const render = grants.getByRole('switch', { name: '미리보기와 PDF 출력' });
    await write.click(); await grants.waitForFunction(() => window.grantDirty);
    await grants.evaluate(() => window.patchGrants({ render: true }));
    await grants.getByText('서버의 권한이 변경됐습니다.', { exact: false }).waitFor();
    assert.equal(await render.getAttribute('aria-checked'), 'false');
    await write.click(); await grants.waitForFunction(() => !window.grantDirty);
    assert.equal(await render.getAttribute('aria-checked'), 'true');
    await grants.evaluate(() => window.patchGrants({ render: true }));
    assert.equal(await grants.getByRole('button', { name: '권한 저장', exact: true }).isDisabled(), true);
    await write.click(); await grants.evaluate(() => window.patchGrants({ libraryRead: true }));
    await grants.getByRole('button', { name: '최신 권한 불러오기' }).click();
    await grants.waitForFunction(() => !window.grantDirty);
    await render.click(); await grants.getByRole('button', { name: '권한 저장', exact: true }).click();
    assert.equal(await grants.evaluate(() => window.grantDirty), true);
    await grants.evaluate(() => { window.saveSucceeds = true; });
    await grants.getByRole('button', { name: '권한 저장', exact: true }).click();
    await grants.waitForFunction(() => !window.grantDirty);
    await write.click(); await grants.evaluate(() => window.nextConnection());
    await grants.waitForFunction(() => !window.grantDirty);
    assert.equal(await write.getAttribute('aria-checked'), 'true');
    await write.click(); await grants.evaluate(() => window.revokeConnection());
    await grants.waitForFunction(() => !window.grantDirty);
    assert.equal(await write.isDisabled(), true); await grants.close();

    const session = await open('session');
    await session.waitForFunction(() => window.probeReady);
    await session.evaluate(() => { window.rememberStore(); window.armOwner(); window.probeSelection({ kind: 'node', nodeId: 'text' }); });
    await session.waitForFunction(() => window.probeSelected === 'text');
    await session.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    assert.deepEqual(await session.evaluate(() => [window.ownerFlushes, window.ownerCloses, window.sameStore()]), [0, 0, true]);
    await session.locator('body').dispatchEvent('pointerdown');
    assert.deepEqual(await session.evaluate(() => [window.ownerFlushes, window.ownerCloses]), [1, 1]);
    await session.evaluate(() => { window.armOwner(); window.hideProbe(); });
    assert.deepEqual(await session.evaluate(() => [window.ownerFlushes, window.ownerCloses]), [2, 2]); await session.close();

    const host = await open('host'); const editor = host.locator('.ProseMirror'); await editor.waitFor(); await editor.focus();
    const handle = await editor.elementHandle();
    const cdp = await host.context().newCDPSession(host);
    await cdp.send('Input.imeSetComposition', { text: '가', selectionStart: 1, selectionEnd: 1 });
    await host.evaluate(() => window.rerenderHost());
    assert.equal(await editor.evaluate((element, original) => element === original, handle), true);
    assert.match(await editor.innerText(), /가/);
    await cdp.send('Input.insertText', { text: '가' });
    await host.evaluate(() => window.hideProbe());
    assert.ok((await host.evaluate(() => window.hostSnapshots)).some(snapshot => snapshot.markdown.includes('가'))); await cdp.detach(); await host.close();

    const buffer = await open('buffer'); await buffer.locator('output').waitFor();
    await buffer.evaluate(() => window.bufferStep());
    await buffer.waitForFunction(() => window.bufferPublishes.length > 0);
    assert.equal(await buffer.locator('output').innerText(), '가나다');
    assert.equal(await buffer.evaluate(() => window.bufferPublishes[0]?.value), '가나다');
    await buffer.evaluate(() => { window.bufferPublishes = []; window.bufferLatestFlush(); });
    await buffer.waitForTimeout(80);
    assert.deepEqual(await buffer.evaluate(() => window.bufferPublishes), [{ value: '최신', version: 1 }]);
    await buffer.evaluate(() => { window.bufferPublishes = []; window.bufferCancel(); });
    await buffer.waitForTimeout(80);
    assert.deepEqual(await buffer.evaluate(() => window.bufferPublishes), []); await buffer.close();

    const drag = await open('drag'); const handleElement = drag.locator('[data-component-drag-handle]'); await handleElement.waitFor();
    const box = present(await handleElement.boundingBox(), 'drag handle');
    await drag.mouse.move(box.x + 3, box.y + 3); await drag.mouse.down();
    assert.equal(await drag.evaluate(() => document.body.style.userSelect), 'none');
    await drag.mouse.move(box.x + 20, box.y + 20); await drag.evaluate(() => window.rerenderDrag()); await drag.locator('#drag-1').waitFor();
    await drag.keyboard.press('Escape'); await drag.mouse.up();
    assert.equal(await drag.evaluate(() => document.body.style.userSelect), '');
    assert.ok((await drag.evaluate(() => window.dragChanges)).includes(1));
    await drag.waitForFunction(() => !document.querySelector('[data-component-drag-handle]')?.className.includes('cursor-grabbing'));
    await handleElement.dispatchEvent('pointerdown', { button: 0, pointerId: 2, clientX: box.x + 3, clientY: box.y + 3 });
    assert.equal(await drag.evaluate(() => document.body.style.userSelect), 'none');
    await drag.evaluate(() => window.hideProbe());
    assert.equal(await drag.evaluate(() => document.body.style.userSelect), ''); await drag.close();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
