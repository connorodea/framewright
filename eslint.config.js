// Flat-config ESLint setup for framewright.
// Goal: catch real bugs, not stylistic preferences. Prettier owns formatting.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'examples/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // Downgrade unused-vars to a warning and allow leading-underscore opt-out.
      // We don't want a fresh lint run to block CI over a temporarily unused arg.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // `no-useless-assignment` (new in eslint@10 recommended) flags defensive
      // `let x = default; if (...) x = a; else x = b;` patterns. The initial
      // assignment documents intent and guards against accidental refactors that
      // skip a branch. We prefer the readability over the micro-optimization.
      'no-useless-assignment': 'off',
    },
  },
  // eslint-config-prettier MUST come last to disable rules that fight Prettier.
  prettier,
];
