import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures.js';

test.describe('Workspace opens without an account', () => {
  test('unsigned launch shows Welcome, and sign-in stays in Settings', async () => {
    const { app, window: page, cleanup } = await launchApp({ skipAuthGate: false });
    try {
      await expect(page.getByRole('dialog', { name: 'The hackable AI note taker' })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByRole('button', { name: 'Create a note' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Welcome back' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /continue locally/i })).toHaveCount(0);

      const [settings] = await Promise.all([
        app.waitForEvent('window'),
        page.evaluate(() =>
          (
            globalThis as unknown as {
              dripnex: { windows: { openSettings: () => Promise<{ ok: boolean }> } };
            }
          ).dripnex.windows.openSettings()
        ),
      ]);
      await settings.waitForLoadState('domcontentloaded');
      await settings.getByRole('button', { name: 'Account' }).click();
      await expect(settings.getByRole('heading', { name: 'Account' })).toBeVisible();
      await settings.getByRole('button', { name: 'Sign In' }).click();
      await expect(settings.getByLabel('Email')).toBeVisible();
      await expect(settings.getByRole('button', { name: 'Send Magic Link' })).toBeVisible();
    } finally {
      await cleanup();
    }
  });
});
