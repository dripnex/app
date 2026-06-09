import { defineConfig } from 'vitest/config';
import { sharedCoverage } from '../../vitest.shared.js';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: sharedCoverage,
  },
});
