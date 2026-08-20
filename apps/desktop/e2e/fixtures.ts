/**
 * Shared E2E fixtures for Electron app tests.
 *
 * `launchApp()` launches a fresh Electron instance with an isolated
 * userData directory so tests don't interfere with each other or with
 * a developer's local Dripnex install. Each test should call this in
 * its own `beforeEach`.
 */

import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

interface LaunchedApp {
  app: ElectronApplication;
  window: Page;
  userDataDir: string;
  /** Call in afterEach. */
  cleanup: () => Promise<void>;
}

/**
 * Launches the desktop app and waits for the first window to be ready.
 *
 * Uses a fresh temp `userData` so the test gets an empty database every
 * time. Set DRIPNEX_E2E_KEEP_USERDATA=1 to keep the dir on failure for
 * post-mortem.
 */
export async function launchApp(): Promise<LaunchedApp> {
  const userDataDir = await mkdtemp(join(tmpdir(), 'dripnex-e2e-'));

  const app = await electron.launch({
    args: [
      '.',
      `--user-data-dir=${userDataDir}`,
      // Disable updates / external network checks during tests.
      '--disable-features=AutoUpdate',
    ],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DRIPNEX_E2E: '1',
      // Pin the data root explicitly so the app uses our temp dir for
      // its SQLite database too, not just for Electron's userData.
      DRIPNEX_DATA_DIR: userDataDir,
    },
  });

  const window = await app.firstWindow();
  // Wait for the renderer to finish initial paint.
  await window.waitForLoadState('domcontentloaded');

  return {
    app,
    window,
    userDataDir,
    cleanup: async () => {
      await app.close().catch(() => {});
      if (process.env.DRIPNEX_E2E_KEEP_USERDATA !== '1') {
        await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
      }
    },
  };
}
