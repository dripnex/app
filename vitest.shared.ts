/**
 * Shared vitest configuration fragments.
 *
 * Each package's vitest.config.ts can spread these to opt into consistent
 * coverage reporting. Thresholds are NOT enforced yet — this is baseline
 * measurement only. When per-package floors are known, replace `undefined`
 * with `{ lines: N, functions: N, branches: N }` in that package's config.
 */
import type { UserConfig } from 'vitest/config';

export const sharedCoverage: NonNullable<NonNullable<UserConfig['test']>['coverage']> = {
  provider: 'v8',
  reporter: ['text', 'lcov'],
  include: ['src/**/*.{ts,tsx}'],
  exclude: [
    '**/*.test.{ts,tsx}',
    '**/__tests__/**',
    '**/tests/**',
    '**/dist/**',
    '**/*.d.ts',
    '**/index.{ts,tsx}',
  ],
};
