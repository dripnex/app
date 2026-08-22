import { test, expect } from '@playwright/test';
import { launchApp, openFirstNote } from './fixtures.js';

/**
 * Drive the CodeMirror 6 surface (`.cm-content`).
 *
 * Earlier e2e avoided this because contenteditable + decorations flake
 * under xvfb. These cases stay small: type visible markdown, optionally
 * press Enter on a list item. Slash / table widgets stay out — those
 * still flake (see tables.spec.ts).
 *
 * Focus: click the last `.cm-line` rather than Control+End. CM keymap
 * + title-input focus races make chord shortcuts less reliable than a
 * click on the empty trailing line (`# Untitled\\n\\n`).
 */
test.describe('CodeMirror editor', () => {
  test('types markdown into .cm-content', async () => {
    const { window, cleanup } = await launchApp();
    try {
      const content = await openFirstNote(window);
      await expect(content).toContainText('Untitled');

      const marker = `e2e-cm-${Date.now()}`;
      await content.locator('.cm-line').last().click();
      await window.keyboard.type(marker, { delay: 15 });

      await expect(content).toContainText(marker);
    } finally {
      await cleanup();
    }
  });

  test('Enter continues a bullet list', async () => {
    const { window, cleanup } = await launchApp();
    try {
      const content = await openFirstNote(window);

      await content.click();
      await window.keyboard.press('ControlOrMeta+A');
      await window.keyboard.type('- first item', { delay: 15 });
      await window.keyboard.press('Enter');

      const lines = content.locator('.cm-line');
      await expect(lines).toHaveCount(2);
      await expect(lines.nth(0)).toContainText('- first item');
      await expect(lines.nth(1)).toHaveText(/^\s*-\s*$/);
    } finally {
      await cleanup();
    }
  });
});
