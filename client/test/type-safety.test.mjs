import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createEmptyDocument } from '../src/foundation/document.ts';
import { requireDocumentNode } from '../src/foundation/documentCommandTargets.ts';
import { editorContextSchema, editorReplySchema } from '../src/foundation/documentSessionProtocol.ts';
import { applyNodeOperation } from '../src/main/application/nodeOperations.ts';
import { applyComponentOperation } from '../src/main/application/componentOperations.ts';
import { readJsonWithBackup } from '../src/main/document/atomicJsonStore.ts';
import { ESLint } from 'eslint';
import { writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

test('required target errors and unsupported operation sentinels remain distinct', () => {
  const document = createEmptyDocument();
  assert.equal(requireDocumentNode(document, document.rootNodeId).id, document.rootNodeId);
  assert.throws(() => requireDocumentNode(document, 'missing'), e => e.detail.code === 'INVALID_TARGET');
  const operation = { type: 'replace_text', target: { kind: 'node', nodeId: document.rootNodeId }, oldText: 'x', newText: 'y' };
  assert.equal(applyNodeOperation(document, operation), undefined);
  assert.equal(applyComponentOperation(document, operation, new Map()), undefined);
});

test('IPC context and reply validators reject malformed external values', () => {
  const context = { documentId: 'doc', revision: 'rev', hasUnsavedChanges: false, isEditing: true, selection: null };
  assert.deepEqual(editorContextSchema.parse(context), context);
  for (const invalid of [null, {}, { ...context, isEditing: 'false' }, { ...context, selection: { target: { kind: 'bad' } } }]) assert.equal(editorContextSchema.safeParse(invalid).success, false);
  assert.equal(editorReplySchema.safeParse({ requestId: 'request', ok: true, context }).success, true);
  assert.equal(editorReplySchema.safeParse({ requestId: 'request', ok: 'true', context }).success, false);
});

test('storage preserves Error identity and wraps other thrown values with cause', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'formleaf-type-safety.'));
  try {
    const path = join(directory, 'fixture.json'); await writeFile(path, '{}');
    const original = new Error('original failure');
    await assert.rejects(readJsonWithBackup(path, () => { throw original; }, 'missing'), e => e === original);
    const detail = { reason: 'invalid record' };
    await assert.rejects(readJsonWithBackup(path, () => { throw detail; }, 'missing'), e => e instanceof Error && e.cause === detail);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('typed lint enforces unsafe and unused values with narrow argument/rest allowances', async () => {
  const file = 'src/foundation/type-safety-probe.ts';
  writeFileSync(file, 'declare const external: any;\nexport const unsafe = external.field;\nconst _unused = 1;\nexport function position(_first: number, second: number) { return second; }\nexport function omit(input: {secret:string;visible:string}) { const {secret, ...rest} = input;return rest; }\n');
  try {
    const [result] = await new ESLint().lintFiles([file]);
    assert.ok(result.messages.some(m => m.ruleId === '@typescript-eslint/no-explicit-any'));
    assert.ok(result.messages.some(m => m.ruleId === '@typescript-eslint/no-unsafe-member-access'));
    const unused = result.messages.filter(m => m.ruleId === '@typescript-eslint/no-unused-vars');
    assert.equal(unused.length, 1, JSON.stringify(result.messages)); assert.match(unused[0].message, /_unused/);
  } finally { unlinkSync(file); }
});

test('compiler rejects unchecked indexing, implicit return and value-only type import', () => {
  const file = 'src/foundation/compiler-probe.ts';
  writeFileSync(file, 'import { DocumentData } from "./documentModel.ts";\nexport const indexed: number = [1][2];\nexport function partial(flag: boolean) { if(flag) return 1; }\nexport const optional: {value?:string} = {value:undefined};\nexport type D = DocumentData;\nclass Base { method() {} }\nexport class Derived extends Base { method() {} }\nexport function fallthrough(x:number) { switch(x) { case 1: x += 1; case 2: return 2; default: return 0; } }\n');
  try {
    const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.foundation.json'], { encoding: 'utf8', timeout: 120000 });
    assert.equal(result.status, 2, result.stdout + result.stderr);
    for (const code of ['TS1484', 'TS2322', 'TS7030', 'TS4114', 'TS7029']) assert.ok(result.stdout.includes(code), result.stdout);
    assert.ok(!result.stdout.includes('optional'), result.stdout);
  } finally { unlinkSync(file); }
});
