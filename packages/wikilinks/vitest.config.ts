import { defineConfig } from 'vitest/config';
import { sharedCoverage } from '../../vitest.shared.js';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: sharedCoverage,
  },
});
