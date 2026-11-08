import { isBuiltin } from 'node:module';
import { posix } from 'node:path';

function layer(file) {
  const path = file.replaceAll('\\', '/');
  const relative = path.slice(path.lastIndexOf('/src/') + 1);
  if (relative.startsWith('src/renderer/src/')) return ['app', 'pages', 'shared'].includes(relative.split('/')[3]) ? relative.split('/')[3] : 'renderer';
  return relative.split('/')[1];
}
const forbidden = {
  foundation: ['main', 'preload', 'app', 'pages', 'shared', 'renderer'],
  main: ['preload', 'app', 'pages', 'shared', 'renderer'],
  preload: ['main', 'app', 'pages', 'shared', 'renderer'],
  app: ['main', 'preload'],
  pages: ['main', 'preload', 'app'],
  shared: ['main', 'preload', 'app', 'pages'],
};
export default {
  rules: {
    imports: {
      meta: { type: 'problem', schema: [], messages: { boundary: '{{from}} cannot import {{source}} ({{to}}).' } },
      create(context) {
        const file = context.filename.replaceAll('\\', '/');
        const from = layer(file);
        function check(node) {
          const source = node.source ?? node.arguments?.[0];
          if (typeof source?.value !== 'string') return;
          const value = source.value;
          const target = value.startsWith('@/')
            ? posix.join(file.slice(0, file.indexOf('/src/')), 'src/renderer/src', value.slice(2))
            : value.startsWith('.') ? posix.resolve(posix.dirname(file), value) : undefined;
          const to = target ? layer(target) : isBuiltin(value) || value === 'electron' ? 'Node/Electron' : undefined;
          if ((to === 'Node/Electron' && ['foundation', 'app', 'pages', 'shared'].includes(from)) || forbidden[from]?.includes(to)) {
            context.report({ node: source, messageId: 'boundary', data: { from, source: value, to } });
          }
        }
        return { ImportDeclaration: check, ExportNamedDeclaration: check, ExportAllDeclaration: check, ImportExpression: check, 'CallExpression[callee.name="require"]': check };
      },
    },
  },
};
