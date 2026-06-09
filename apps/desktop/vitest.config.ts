import { defineConfig } from 'vitest/config';
import { sharedCoverage } from '../../vitest.shared.js';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: sharedCoverage,
  },
});
