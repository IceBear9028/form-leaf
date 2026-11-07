import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import boundaries from './scripts/layer-boundaries.mjs';

// Rules are enabled by their owning feature; later phases extend these scopes.
export default [
  { ignores: ['node_modules/**', 'out/**', 'dist/**', 'test-results/**', 'playwright-report/**'] },
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },
  {
    files: ['src/**/*.{ts,tsx}', 'electron.vite.config.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: ['./tsconfig.foundation.json', './tsconfig.main.json', './tsconfig.preload.json', './tsconfig.renderer.json', './tsconfig.tools.json'], tsconfigRootDir: import.meta.dirname },
    },
    plugins: { '@typescript-eslint': tseslint.plugin, boundaries },
    rules: { 'boundaries/imports': 'error' },
  },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: { globals: globals.node },
    rules: js.configs.recommended.rules,
  },
];
