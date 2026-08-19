import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { BrowserWindow } from 'electron';

function tempHtmlPath(): string {
  return join(tmpdir(), `dripnex-print-${Date.now()}-${Math.random().toString(16).slice(2)}.html`);
}

async function loadHtmlWindow(html: string): Promise<{
  win: BrowserWindow;
  cleanup: () => Promise<void>;
}> {
  const win = new BrowserWindow({
    show: false,
    width: 800,
    height: 1100,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const tmp = tempHtmlPath();
  await writeFile(tmp, html, 'utf-8');
  await win.loadFile(tmp);
  return {
    win,
    async cleanup() {
      if (!win.isDestroyed()) win.destroy();
      await unlink(tmp).catch(() => {});
    },
  };
}

export async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  const { win, cleanup } = await loadHtmlWindow(html);
  try {
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
    });
    return Buffer.from(pdf);
  } finally {
    await cleanup();
  }
}

export async function printHtml(html: string): Promise<{ success: boolean; error?: string }> {
  const { win, cleanup } = await loadHtmlWindow(html);
  try {
    const result = await new Promise<{ success: boolean; error?: string }>(resolve => {
      win.webContents.print({ printBackground: true }, (success, failureReason) => {
        if (success) resolve({ success: true });
        else resolve({ success: false, error: failureReason || 'Print cancelled' });
      });
    });
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Print failed',
    };
  } finally {
    await cleanup();
  }
}
