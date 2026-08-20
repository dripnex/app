import { defineConfig } from '@playwright/test';

/**
 * Playwright config for the Dripnex Electron app.
 *
 * Tests are end-to-end against the built Electron bundle in `out/`,
 * launched via Playwright's `electron` API (`_electron.launch`).
 *
 * Before running: `pnpm build` to produce `out/main/index.js`.
 *
 * Local: `pnpm e2e`            — headless against the build
 *        `pnpm e2e:headed`     — open the actual window
 *
 * On CI we run linux + xvfb. See .github/workflows/ci.yml.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Electron app state is shared; tests run serially
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
});
