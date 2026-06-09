import { defineConfig } from 'vitest/config';
import { sharedCoverage } from '../../vitest.shared.js';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: sharedCoverage,
  },
});
