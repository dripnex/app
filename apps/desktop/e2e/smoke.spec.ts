import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures.js';

test.describe('app launch (smoke)', () => {
  test('launches and shows the main window', async () => {
    const { app, window, cleanup } = await launchApp();
    try {
      // Title is "Dripnex" in production. Allow any non-empty title in case
      // dev/test envs use a different one.
      const title = await window.title();
      expect(title.length).toBeGreaterThan(0);

      // First window must render *something* — a <body> element with non-zero
      // size is a low bar that catches the regression class from PR #266
      // (editor mount crashes that produced a blank window).
      const bodyBox = await window.locator('body').boundingBox();
      expect(bodyBox).not.toBeNull();
      expect(bodyBox!.width).toBeGreaterThan(0);
      expect(bodyBox!.height).toBeGreaterThan(0);

      // Sanity: the app exposed its IPC bridge.
      const hasBridge = await window.evaluate(
        () => typeof (window as unknown as { dripnex?: unknown }).dripnex !== 'undefined'
      );
      expect(hasBridge).toBe(true);

      expect(app.windows().length).toBeGreaterThanOrEqual(1);
    } finally {
      await cleanup();
    }
  });

  test('console does not log uncaught errors during initial render', async () => {
    const { window, cleanup } = await launchApp();
    const consoleErrors: string[] = [];
    window.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    window.on('pageerror', err => consoleErrors.push(`pageerror: ${err.message}`));

    try {
      // Give the renderer 3s to throw any early errors during mount.
      await window.waitForTimeout(3000);

      // Known non-fatal noise that the app emits in test/dev environments.
      // Strip these out before asserting "no errors".
      const ignored = [
        /\[Sentry\]/, // "No DSN configured" — expected without VITE_SENTRY_DSN
        /Failed to load resource: net::ERR_/, // network during dev sometimes
      ];
      const real = consoleErrors.filter(line => !ignored.some(re => re.test(line)));

      expect(real, real.join('\n')).toEqual([]);
    } finally {
      await cleanup();
    }
  });
});
