import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ESLint } from 'eslint';
import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
const lint = new ESLint({ overrideConfig: [{ files: ['src/**/*.{ts,tsx}'], languageOptions: { parserOptions: { project: false } } }] });
test('layer boundaries reject relative, alias, type, re-export and dynamic edges', async () => {
  for (const [filePath, source, rejected] of [
    ['src/main/probe.ts', 'import "../renderer/src/pages/x.ts"', true],
    ['src/main/probe.ts', 'import type { X } from "@/pages/x"', true],
    ['src/preload/probe.ts', 'export * from "../main/x.ts"', true],
    ['src/renderer/src/shared/probe.ts', 'import("../pages/x.ts")', true],
    ['src/renderer/src/pages/probe.ts', 'import "@/app/x"', true],
    ['src/foundation/probe.ts', 'import "node:fs"', true],
    ['src/renderer/src/pages/probe.ts', 'import "node:path"', true],
    ['src/main/probe.ts', 'import "../foundation/document.ts"', false],
    ['src/renderer/src/pages/probe.ts', 'import "../shared/x.ts"', false],
  ]) {
    const [result] = await lint.lintText(source, { filePath });
    assert.equal(result.errorCount > 0, rejected, source + JSON.stringify(result.messages));
  }
});
test('isolated projects reject foreign environment globals', () => {
  for (const [project, file, source] of [
    ['foundation', 'src/foundation/environment-probe.ts', 'export const x = [window, document, process, Buffer];'],
    ['renderer', 'src/renderer/src/environment-probe.ts', 'export const x = [process, Buffer];'],
  ]) {
    writeFileSync(file, source);
    try {
      const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', `tsconfig.${project}.json`], { encoding: 'utf8' });
      assert.equal(result.status, 2, result.stdout + result.stderr);
      for (const name of project === 'foundation' ? ['window', 'document', 'process', 'Buffer'] : ['process', 'Buffer']) assert.ok(result.stdout.includes(`'${name}'`), result.stdout);
    } finally { unlinkSync(file); }
  }
});
