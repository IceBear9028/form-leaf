/* Source-level probes only: no Obsidian app, HTTP server, real vault or SDK execution.
 * Usage: node source-probes.cjs UPSTREAM_CHECKOUT TYPESCRIPT_MODULE
 * Execute only against the reviewed source commit; vm is not a security sandbox.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(process.argv[2]);
const ts = require(path.resolve(process.argv[3]));
const expectedCommit = 'e16ba0e95ed22f0d75c20efbd07b37525da2ba65';
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
assert.equal(commit, expectedCommit, 'Use the reviewed upstream commit');
class TFile { constructor(p) { this.path = p; this.name = path.basename(p); this.extension = 'md'; this.stat = { size: 0 }; } }
class TFolder { constructor(p) { this.path = p; this.name = path.basename(p); this.children = []; } }
// Schema objects are stubs; these probes invoke the actual handler bodies, not SDK validation.
const schema = new Proxy(function () {}, { get: () => schema, apply: () => schema });
const obsidian = { TFile, TFolder, Notice: class {} };
const hashes = {};
function loader(overrides = {}) {
  const cache = new Map();
  function load(relative) {
    const full = path.resolve(root, relative);
    if (cache.has(full)) return cache.get(full).exports;
    const input = fs.readFileSync(full, 'utf8');
    hashes[path.relative(root, full)] = crypto.createHash('sha256').update(input).digest('hex');
    const code = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const mod = { exports: {} };
    cache.set(full, mod);
    const req = (id) => {
      if (id in overrides) return overrides[id];
      if (id === 'obsidian') return obsidian;
      if (id === 'zod') return { z: schema };
      if (id === 'crypto' || id === 'http') return require(id);
      if (id === 'express') return () => { throw new Error('HTTP execution excluded'); };
      if (id.startsWith('@modelcontextprotocol/')) return {};
      if (id.endsWith('.json')) return JSON.parse(fs.readFileSync(path.resolve(path.dirname(full), id), 'utf8'));
      if (id.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(full), id + '.ts')));
      throw new Error('Unexpected dependency: ' + id);
    };
    vm.runInNewContext('(function(require,module,exports){' + code + '\n})', {
      Buffer, console: { debug() {}, warn() {}, error() {} },
      window: { setTimeout: () => 1, clearTimeout() {} },
    }, { filename: full })(req, mod, mod.exports);
    return mod.exports;
  }
  return load;
}
const load = loader();
const { SecurityManager } = load('src/security.ts');
function fixture() {
  const files = [new TFile('Secret/private.md'), new TFile('Public/note.md')];
  const folders = [new TFolder('Secret'), new TFolder('Public')];
  const callbacks = {};
  const plugin = {
    settings: { blacklist: 'Secret/\n#secret', enableInstructions: true, includeVaultStructure: true, customInstructions: '', enableResourceSubscriptions: true },
    app: {
      vault: {
        getName: () => 'Fixture', getRoot: () => ({ children: folders }), getFiles: () => files,
        getAbstractFileByPath: p => files.find(f => f.path === p) ?? null,
        on: (name, callback) => { callbacks[name] = callback; return name; },
        read: async () => 'base', modify: async () => {},
      },
      metadataCache: { getFileCache: () => null, getTags: () => ({ '#private-project': 1 }) },
    },
  };
  plugin.security = new SecurityManager(plugin);
  return { plugin, callbacks, files };
}
const tracker = { track: (_name, handler) => handler };
const logger = { warning() {}, error() {} };
function tool(modulePath, exportName, plugin, customLoad = load) {
  let handler;
  customLoad(modulePath)[exportName]({ registerTool: (_name, _config, fn) => { handler = fn; } }, plugin, tracker, logger);
  return handler;
}
const results = [];
async function check(id, description, run) {
  const observed = await run();
  results.push({ id, description, status: 'confirmed-in-source-probe', observed });
}
(async () => {
  await check('P01', 'Blacklist is a prefix filter, not filesystem confinement', () => {
    const { plugin } = fixture();
    const cases = Object.fromEntries(['Secret/private.md', 'Public/../Secret/private.md', 'SecretsArchive/file.md', '../../outside.md', '/tmp/outside.md', '.obsidian/plugins/mcp-server/main.js'].map(p => [p, plugin.security.isAllowed(p)]));
    assert.equal(cases['Secret/private.md'], false);
    assert.equal(cases['Public/../Secret/private.md'], false);
    assert.equal(cases['SecretsArchive/file.md'], false);
    assert.equal(cases['../../outside.md'], true);
    assert.equal(cases['/tmp/outside.md'], true);
    assert.equal(cases['.obsidian/plugins/mcp-server/main.js'], true);
    return cases; // This does NOT establish that Obsidian accepts these paths.
  });
  await check('P02', 'Instructions and overview include blocked top-level folder names', () => {
    const { plugin } = fixture();
    const instructions = load('src/instructions.ts').buildInstructions(plugin);
    let handler;
    load('src/resources/static.ts').registerStaticResources({ registerResource: (...args) => { handler = args.at(-1); } }, plugin);
    const overview = JSON.parse(handler().contents[0].text);
    assert(instructions.includes('Secret'));
    assert(overview.topFolders.includes('Secret'));
    assert.equal(overview.fileCount, 1);
    return { instructionsIncludeBlockedFolder: true, topFolders: overview.topFolders, visibleFileCount: overview.fileCount };
  });
  await check('P03', 'Modify notification emits blocked file URI to registered session', () => {
    const { plugin, callbacks, files } = fixture();
    const sent = [];
    const manager = new (load('src/resources/subscriptions.ts').ResourceSubscriptionManager)(plugin);
    manager.registerSession({ server: { sendResourceUpdated: async value => { sent.push(value); } } });
    manager.start();
    callbacks.modify(files[0]);
    assert.equal(sent[0].uri, 'obsidian://notes/Secret%2Fprivate.md');
    return sent; // Actual SDK/client delivery is not tested.
  });
  await check('P04', 'Global tag counts do not apply file path filtering', () => {
    const { plugin } = fixture();
    const result = tool('src/tools/list-all-tags.ts', 'registerListAllTags', plugin)();
    assert.equal(result.structuredContent.tags['#private-project'], 1);
    return result.structuredContent;
  });
  await check('P05', 'Daily-note creation precedes access rejection', async () => {
    const { plugin, files } = fixture();
    let creates = 0;
    const custom = loader({ '../moment': { moment: () => ({}) }, 'obsidian-daily-notes-interface': {
      getAllDailyNotes: () => ({}), getDailyNote: () => undefined,
      createDailyNote: async () => { creates++; return files[0]; },
    } });
    const result = await tool('src/tools/append-daily-note.ts', 'registerAppendDailyNote', plugin, custom)({ text: 'example' });
    assert.equal(creates, 1);
    assert.equal(result.isError, true);
    return { createDailyNoteCalls: creates, returnedError: result.isError };
  });
  await check('P06', 'Concurrent append handlers can overwrite one another', async () => {
    const { plugin } = fixture();
    let value = 'base';
    const writes = [];
    plugin.app.vault.read = async () => value;
    plugin.app.vault.modify = async (_file, content) => { writes.push(content); value = content; };
    const append = tool('src/tools/append-note.ts', 'registerAppendNote', plugin);
    await Promise.all([append({ path: 'Public/note.md', content: 'A', mode: 'append' }), append({ path: 'Public/note.md', content: 'B', mode: 'append' })]);
    assert.equal(value, 'base\nB');
    return { writes, finalValue: value };
  });
  await check('P07', 'Repeated patch can mutate again despite idempotentHint', async () => {
    const { plugin } = fixture();
    let value = 'x';
    plugin.app.vault.read = async () => value;
    plugin.app.vault.modify = async (_f, text) => { value = text; };
    const patch = tool('src/tools/patch-note.ts', 'registerPatchNote', plugin);
    const args = { path: 'Public/note.md', old_string: 'x', new_string: 'xy' };
    await patch(args);
    await patch(args);
    assert.equal(value, 'xyy');
    return { finalValue: value, idempotentHint: load('src/tools/constants.ts').WRITE_IDEMPOTENT_ANNOTATIONS.idempotentHint };
  });
  await check('P08', 'Stats count returned isError as success', async () => {
    let stats = {};
    const instance = new (load('src/stats.ts').StatsTracker)(() => stats, value => { stats = value; }, async () => {});
    await instance.track('denied_fixture', () => ({ isError: true }))();
    assert.equal(stats.denied_fixture.successful, 1);
    return stats;
  });
  await check('P09', 'Actual auth middleware: valid token, rejection, query token, auth-off bypass', () => {
    const custom = loader({ './tools': {}, './prompts': {}, './resources': {}, './logging': {} });
    const Server = custom('src/server.ts').McpHttpServer;
    function auth(requireAuth, headers = {}, query = {}) {
      const server = new Server({ settings: { requireAuth, authToken: 'fixture-only-token' } });
      const output = { next: false, status: null };
      const res = { status(code) { output.status = code; return this; }, json() {} };
      server.createAuthMiddleware()({ headers, query }, res, () => { output.next = true; });
      return output;
    }
    const cases = {
      valid: auth(true, { authorization: 'Bearer fixture-only-token' }), missing: auth(true),
      query: auth(true, {}, { token: 'fixture-only-token' }), disabled: auth(false),
    };
    assert.equal(cases.valid.next, true);
    assert.equal(cases.missing.status, 403);
    assert.equal(cases.query.next, true);
    assert.equal(cases.disabled.next, true);
    return cases;
  });
  console.log(JSON.stringify({ commit, node: process.version, typescript: ts.version,
    boundary: 'Actual transpiled source functions with mocked Obsidian, schema and SDK boundaries; no HTTP, OS sandbox or real vault verification',
    results, sourceSha256: hashes }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
