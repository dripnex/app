import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { sharedCoverage } from '../../vitest.shared.js';

export default defineConfig({
  resolve: {
    alias: {
      electron: resolve(__dirname, 'src/main/__mocks__/electron.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: sharedCoverage,
  },
});
