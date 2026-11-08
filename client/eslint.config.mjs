import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import boundaries from './scripts/layer-boundaries.mjs';

// Rules are enabled by their owning feature; later phases extend these scopes.
export default [
  { ignores: ['node_modules/**', 'out/**', 'dist/**', 'test-results/**', 'playwright-report/**'] },
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },
  {
    files: ['src/**/*.{ts,tsx}', 'electron.vite.config.ts', 'test/**/*.ts', 'e2e/**/*.ts', 'playwright.config.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: ['./tsconfig.foundation.json', './tsconfig.main.json', './tsconfig.preload.json', './tsconfig.renderer.json', './tsconfig.tools.json', './tsconfig.test.json', './tsconfig.e2e.json'], tsconfigRootDir: import.meta.dirname },
    },
    plugins: { '@typescript-eslint': tseslint.plugin, boundaries },
    rules: {
      ...js.configs.recommended.rules,
      ...Object.assign({}, ...tseslint.configs.recommendedTypeChecked.map(config => config.rules)),
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      'boundaries/imports': 'error',
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: false }],
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: { globals: globals.node },
    rules: js.configs.recommended.rules,
  },
];
