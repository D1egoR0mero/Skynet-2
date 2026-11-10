// ESLint flat config (ESLint 9).
//
// Scope: the application's own JavaScript only. Generated artifacts
// (node_modules, submission packages, opencode runtime) are ignored so that
// lint results reflect code we maintain.
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      '.opencode/**',
      'cs3704-submission-*/**',
      'data/**',
    ],
  },
  js.configs.recommended,
  {
    // The codebase intentionally uses empty catch blocks for best-effort
    // cache/storage reads where a failure means "use the fallback".
    rules: {
      'no-empty': ['error', {allowEmptyCatch: true}],
    },
  },
  {
    files: ['src/**/*.js', 'server.js', 'test/**/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {...globals.node},
    },
  },
  {
    files: ['public/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {...globals.browser},
    },
  },
];
