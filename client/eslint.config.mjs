import a11y from 'eslint-plugin-jsx-a11y';
import { reactRefresh } from 'eslint-plugin-react-refresh';
import react from 'eslint-plugin-react';
import hooks from 'eslint-plugin-react-hooks';
import { fixupPluginRules } from '@eslint/compat';
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
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: { react: fixupPluginRules(react), 'react-hooks': hooks },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/jsx-key': 'error',
      'react/jsx-no-duplicate-props': 'error',
      'react/no-unknown-property': 'error',
      ...Object.fromEntries(['rules-of-hooks', 'exhaustive-deps', 'set-state-in-render', 'immutability', 'purity', 'globals', 'static-components'].map(rule => ['react-hooks/' + rule, 'error'])),
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: { 'jsx-a11y': fixupPluginRules(a11y), 'react-refresh': reactRefresh.plugin },
    rules: {
      ...Object.fromEntries(['alt-text', 'label-has-associated-control', 'aria-props', 'aria-proptypes', 'role-has-required-aria-props'].map(rule => ['jsx-a11y/' + rule, 'error'])),
      'jsx-a11y/label-has-associated-control': ['error', { labelComponents: ['Label', 'FieldLabel'], controlComponents: ['Input', 'Switch', 'SelectControl'], assert: 'either', depth: 3 }],
      ...Object.fromEntries(['click-events-have-key-events', 'interactive-supports-focus', 'no-static-element-interactions', 'no-autofocus'].map(rule => ['jsx-a11y/' + rule, 'warn'])),
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: { globals: globals.node },
    rules: js.configs.recommended.rules,
  },
];
