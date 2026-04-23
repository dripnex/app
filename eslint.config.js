import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';

export default tseslint.config(
  // Base ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/release/**',
      '**/.astro/**',
      '**/coverage/**',
      '**/.vitepress/cache/**',
      '**/.wrangler/**',
      '**/.next/**',
      '**/.source/**',
      '**/next-env.d.ts',
      'packages/ai-assistant/**',
    ],
  },

  // JavaScript base rules
  js.configs.recommended,

  // TypeScript rules
  ...tseslint.configs.recommended,

  // Project-wide settings (non-type-aware — applies to ALL files)
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      'import-x': importX,
    },
    rules: {
      // === Architecture Protection ===
      'import-x/no-cycle': 'error',
      'import-x/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'never',
        },
      ],

      // === TypeScript Safety ===
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-require-imports': 'off',

      // === Practical Rules ===
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',

      // === Disabled Style Rules (Prettier handles these) ===
      indent: 'off',
      quotes: 'off',
      semi: 'off',
      'comma-dangle': 'off',
    },
  },

  // Type-aware rules — only for source files inside tsconfig projects
  {
    files: [
      'apps/*/src/**/*.ts',
      'apps/*/src/**/*.tsx',
      'packages/*/src/**/*.ts',
      'packages/*/src/**/*.tsx',
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'warn',
    },
  },

  // Package-specific overrides
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron', 'better-sqlite3', '@readied/storage-sqlite'],
              message: 'Core package must remain pure. No Electron or native dependencies.',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['packages/storage-core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron', 'better-sqlite3'],
              message: 'Storage-core must remain pure. Native deps go in storage-sqlite.',
            },
          ],
        },
      ],
    },
  },

  // Test files - relax some rules
  {
    files: ['**/*.test.ts', '**/tests/**/*.ts', '**/__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  // Config files
  {
    files: ['**/*.config.js', '**/*.config.ts', '**/*.config.mjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  }
);
