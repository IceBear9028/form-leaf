import { z } from "zod";
import * as Check from "./fixtures/assertions.ts";
import tseslint from 'typescript-eslint';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { ESLint } from 'eslint';

const filePath = 'src/foundation/analysis-fixture.ts';
const eslint = new ESLint({ overrideConfig: [{
  files: ['src/**/*.ts'],
  languageOptions: { parserOptions: { project: false, programs: null } },
  rules: { ...Check.present(tseslint.configs.disableTypeChecked.rules, 'fixture spread'), 'no-debugger': 'error', 'no-console': 'warn' },
}] });

await test('lint severity distinguishes clean, warnings, errors and unused exceptions', async () => {
  for (const [source, errors, warnings] of [
    ['export {};', 0, 0], ['console.log("warning");', 0, 1], ['debugger;', 1, 0],
    ['// eslint-disable-next-line no-debugger -- intentional fixture\ndebugger;', 0, 0],
    ['// eslint-disable-next-line no-debugger -- unused fixture\nexport {};', 1, 0],
  ] as const) {
    const [result] = await eslint.lintText(source, { filePath });
    assert.equal(Check.present(result, 'fixture value').errorCount, errors);
    assert.equal(Check.present(result, 'fixture value').warningCount, warnings);
  }
});

await test('CLI exits successfully for warnings and fails for errors', () => {
  for (const [source, rule, status] of [['console.log(1)', 'no-console:warn', 0], ['debugger;', 'no-debugger:error', 1]] as const) {
    const result = spawnSync(process.execPath, ['node_modules/eslint/bin/eslint.js', '--stdin', '--stdin-filename', 'scripts/analysis-fixture.mjs', '--rule', rule], { input: source, encoding: 'utf8' });
    assert.equal(result.status, status, result.stdout + result.stderr);
  }
});

await test('a type-aware rule reads the real product project', async () => {
  const typed = new ESLint({ overrideConfig: [{ files: ['src/**/*.ts'], rules: { '@typescript-eslint/await-thenable': 'error' } }] });
  const config = z.object({ languageOptions: z.object({ parserOptions: z.object({ project: z.array(z.string()) }) }) }).parse(await typed.calculateConfigForFile('src/foundation/documentModel.ts'));
  assert.ok(config.languageOptions.parserOptions.project.includes('./tsconfig.foundation.json'));
  const results = await typed.lintFiles(['src/foundation/**/*.ts']);
  assert.ok(results.length > 0);
  assert.equal(results.reduce((n, r) => n + r.fatalErrorCount + r.errorCount, 0), 0);
});
