import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures.js';

test.describe('AuthGate is the first window', () => {
  test('unsigned launch shows magic-link Sign in, not Welcome or workspace', async () => {
    const { window, cleanup } = await launchApp({ skipAuthGate: false });
    try {
      await expect(window.getByRole('tab', { name: 'Sign in' })).toBeVisible({
        timeout: 15_000,
      });
      await expect(window.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
      await expect(window.getByText('The hackable AI note taker')).toBeVisible();
      await expect(window.getByRole('button', { name: 'Email me a link' })).toBeVisible();
      await expect(window.locator('canvas')).toHaveCount(1);

      await expect(window.getByRole('button', { name: 'Create Your First Note' })).toHaveCount(0);
      await expect(window.getByRole('button', { name: /continue locally/i })).toHaveCount(0);
    } finally {
      await cleanup();
    }
  });
});
