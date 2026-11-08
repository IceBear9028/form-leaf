import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { present } from './fixtures/assertions.ts';

await test('accessibility errors, focus warnings and Vite Refresh exports keep the agreed severities', async () => {
  const eslint = new ESLint({ overrideConfig: [{
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { parserOptions: { project: false } },
    rules: tseslint.configs.disableTypeChecked.rules,
  }] });
  const lint = async (source: string) => present((await eslint.lintText(source, {
    filePath: 'src/renderer/src/accessibility-probe.tsx',
  }))[0], 'lint fixture');
  const bad = await lint('import {Label} from "./shared/ui/label"; export function Bad(){return <><img src="x"/><label>Unbound</label><Label>Unbound wrapper</Label><div aria-mystery="x" aria-hidden="invalid" role="checkbox"/></>}');
  for (const rule of ['alt-text', 'label-has-associated-control', 'aria-props', 'aria-proptypes', 'role-has-required-aria-props']) {
    assert.ok(bad.messages.some(message => message.ruleId === `jsx-a11y/${rule}` && message.severity === 2), rule);
  }
  assert.equal(bad.messages.filter(message => message.ruleId === 'jsx-a11y/label-has-associated-control').length, 2);
  const good = await lint('import {Label} from "./shared/ui/label"; import {Input} from "./shared/ui/input"; export function Good(){return <><Label htmlFor="name">Name</Label><Input id="name"/><label>Choice<SelectControl/></label></>} function SelectControl(){return <button type="button">Choose</button>}');
  assert.equal(good.errorCount, 0);
  const warnings = await lint('export function Warning(){return <><div onClick={()=>{}} autoFocus/><div role="button" onKeyDown={()=>{}} onClick={()=>{}}/></>}');
  assert.equal(warnings.errorCount, 0);
  for (const rule of ['click-events-have-key-events', 'interactive-supports-focus', 'no-static-element-interactions', 'no-autofocus']) {
    assert.ok(warnings.messages.some(message => message.ruleId === `jsx-a11y/${rule}` && message.severity === 1), rule);
  }
  const constants = await lint('export const VERSION="one"; export function View(){return <div/>}');
  assert.equal(constants.messages.filter(message => message.ruleId === 'react-refresh/only-export-components').length, 0);
  const mixed = await lint('export const helper=()=>1; export function View(){return <div/>}');
  assert.equal(mixed.errorCount, 0);
  assert.ok(mixed.messages.some(message => message.ruleId === 'react-refresh/only-export-components' && message.severity === 1));
});

await test('real label wrappers and nested select stay connected; rename autofocus and Enter submit once', async () => {
  const bundle = await build({
    entryPoints: ['test/fixtures/accessibility-harness.ts'], bundle: true, write: false,
    format: 'iife', jsx: 'automatic', alias: { '@': resolve('src/renderer/src') },
    define: { 'process.env.NODE_ENV': '"development"' },
  });
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(8_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://formleaf.test/**', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto('http://formleaf.test/');
    await page.addScriptTag({ content: present(bundle.outputFiles[0], 'browser bundle').text });
    for (const name of ['Plain label', 'Field label']) {
      const control = page.getByRole('textbox', { name, exact: true });
      await control.waitFor();
      assert.equal(await control.evaluate((input: HTMLInputElement) => input.labels?.length), 1);
    }
    const label = page.locator('label').filter({ hasText: '선택한 컴포넌트' });
    assert.equal(await label.evaluate((element: HTMLLabelElement) => {
      const control = element.control;
      return control instanceof HTMLButtonElement && control.getAttribute('role') === 'combobox' && [...(control.labels ?? [])].includes(element);
    }), true);
    await page.getByRole('button', { name: '문서 작업' }).click();
    await page.getByRole('menuitem', { name: '이름 변경' }).click();
    const rename = page.getByRole('textbox', { name: '문서 이름', exact: true });
    await rename.waitFor();
    assert.equal(await rename.evaluate(element => element === document.activeElement), true);
    await rename.fill('새 이름');
    await rename.press('Enter');
    await page.getByRole('dialog', { name: '문서 이름 변경' }).waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#rename-log').innerText(), JSON.stringify([{ id: 'rename', name: '새 이름' }]));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
