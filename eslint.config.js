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
    ],
  },

  // JavaScript base rules
  js.configs.recommended,

  // TypeScript rules
  ...tseslint.configs.recommended,

  // Project-wide settings
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.config.js', '*.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'import-x': importX,
    },
    rules: {
      // === Architecture Protection ===

      // Prevent circular dependencies
      'import-x/no-cycle': 'error',

      // Enforce import order (optional, remove if annoying)
      'import-x/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'never',
        },
      ],

      // === TypeScript Safety ===

      // Allow any when truly needed, but warn
      '@typescript-eslint/no-explicit-any': 'warn',

      // Catch forgotten awaits
      '@typescript-eslint/no-floating-promises': 'warn',

      // Allow unused vars starting with _
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Allow require for native modules (Electron pattern)
      '@typescript-eslint/no-require-imports': 'off',

      // === Practical Rules ===

      // No console in production code (warn only)
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Prefer const
      'prefer-const': 'error',

      // No var
      'no-var': 'error',

      // === Disabled Style Rules (Prettier handles these) ===
      indent: 'off',
      quotes: 'off',
      semi: 'off',
      'comma-dangle': 'off',
    },
  },

  // Package-specific overrides
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      // Core must be pure - no Node.js specific imports
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
      // Storage-core must be pure too
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
    files: ['**/*.test.ts', '**/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  // Config files - CommonJS allowed
  {
    files: ['**/*.config.js', '**/*.config.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  }
);
