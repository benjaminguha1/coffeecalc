import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['dist', 'coverage'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
    },
  },
  {
    files: ['vite.config.js', 'build/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['worker/**/*.js'],
    languageOptions: {
      globals: globals.serviceworker,
    },
  },
  {
    files: ['**/*.test.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
];
