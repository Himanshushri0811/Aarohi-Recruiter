// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Base JS rules
  js.configs.recommended,

  // TypeScript rules
  ...tseslint.configs.recommendedTypeChecked,

  // Project configuration
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Custom rules
  {
    rules: {
      // Allow explicit any in exceptional cases (use sparingly)
      '@typescript-eslint/no-explicit-any': 'warn',

      // Require explicit return types on public functions
      '@typescript-eslint/explicit-function-return-type': 'off',

      // Disallow floating promises
      '@typescript-eslint/no-floating-promises': 'error',

      // Enforce consistent type imports
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],

      // Warn on unused vars (prefix _ to suppress)
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // No console.log in production code (use logger)
      'no-console': 'warn',
    },
  },

  // Ignore patterns
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.js'],
  },
);
