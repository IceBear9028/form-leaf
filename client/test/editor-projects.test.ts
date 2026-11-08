import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { z } from 'zod';
import { startTypeScriptServer } from './fixtures/tsserver-client.ts';

const projectSchema = z.object({ configFileName: z.string(), fileNames: z.array(z.string()) });

await test('editor discovers isolated projects and browser declarations from the solution config', { timeout: 120_000 }, async () => {
  const server = startTypeScriptServer(process.env.FORMLEAF_TSSERVER_PATH ?? resolve('node_modules/typescript/lib/tsserver.js'));
  try {
    for (const [relative, project, hasBrowserGlobals] of [
      ['e2e/agent-content.spec.ts', 'e2e', true],
      ['test/react-behavior.test.ts', 'test', true],
      ['src/foundation/documentModel.ts', 'foundation', false],
      ['src/main/index.ts', 'main', false],
      ['src/preload/index.ts', 'preload', false],
      ['src/renderer/src/app/App.tsx', 'renderer', false],
      ['electron.vite.config.ts', 'tools', false],
      ['playwright.config.ts', 'e2e', true],
    ] as const) {
      const file = resolve(relative);
      await server.request('open', { file, projectRootPath: process.cwd() });
      const info = projectSchema.parse(await server.request('projectInfo', { file, needFileNameList: true }));
      assert.equal(info.configFileName, resolve(`tsconfig.${project}.json`), relative);
      assert.equal(info.fileNames.some(name => name.endsWith('/browser-globals.d.ts')), hasBrowserGlobals, relative);
      assert.deepEqual(await server.request('semanticDiagnosticsSync', { file }), [], relative);
      assert.deepEqual(await server.request('compilerOptionsDiagnostics-full', { projectFileName: info.configFileName }), [], relative);
      await server.request('close', { file });
    }
    assert.deepEqual(await server.request('compilerOptionsDiagnostics-full', { projectFileName: resolve('tsconfig.json') }), []);
  } finally { await server.close(); }
});
