import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures.js';

const WIDE_TABLE = [
  '# Wide table',
  '',
  '| Col | Value |',
  '| --- | --- |',
  `| x | ${'verylongunbrokenstring'.repeat(20)} |`,
  '',
  'end',
].join('\n');

test.describe('tables overflow', () => {
  test('editor widget stays within the content pane', async () => {
    const { window, cleanup } = await launchApp();
    try {
      await window.getByRole('button', { name: 'Create Your First Note' }).click();

      const content = window.locator('.cm-content');
      await expect(content).toBeVisible({ timeout: 15_000 });
      await content.click();
      await window.keyboard.press('Meta+A');
      await window.keyboard.insertText(WIDE_TABLE);

      // Move the cursor out of the table so the WYSIWYG widget paints.
      await window.getByText('end', { exact: true }).click();

      const widget = window.locator('.cm-table-widget').first();
      await expect(widget).toBeVisible({ timeout: 10_000 });

      const scroller = window.locator('.cm-scroller').first();
      const widgetBox = await widget.boundingBox();
      const scrollerBox = await scroller.boundingBox();
      expect(widgetBox).not.toBeNull();
      expect(scrollerBox).not.toBeNull();
      expect(widgetBox!.width).toBeLessThanOrEqual(scrollerBox!.width + 1);
    } finally {
      await cleanup();
    }
  });
});
