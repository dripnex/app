import { BrowserWindow, globalShortcut, ipcMain } from 'electron';
import { getLogger } from '../logger.js';
import { isClosable } from './closable.js';
import { createMainWindow } from './mainWindow.js';
import { createNoteWindow } from './noteWindow.js';
import { createQuickCaptureWindow } from './quickCaptureWindow.js';
import { createSettingsWindow } from './settingsWindow.js';
import { applyFrosted } from './vibrancy.js';

export function registerWindowHandlers(): void {
  ipcMain.handle('window:openNote', async (_event, noteId: string, noteTitle: string) => {
    createNoteWindow(noteId, noteTitle);
    return { ok: true };
  });

  ipcMain.handle('window:openSettings', async () => {
    createSettingsWindow();
    return { ok: true };
  });

  ipcMain.handle('window:openQuickCapture', async () => {
    createQuickCaptureWindow();
    return { ok: true };
  });

  ipcMain.handle('window:setButtonVisibility', (event, visible: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return { ok: false };
    if (process.platform === 'darwin') {
      win.setWindowButtonVisibility(visible === true);
    }
    return { ok: true };
  });

  ipcMain.handle('window:setFrosted', (_event, frosted: unknown) => {
    const on = frosted === true;
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue;
      applyFrosted(win, on);
    }
    return { ok: true };
  });

  ipcMain.handle('window:closeSelf', async event => {
    const senderId = event.sender.id;
    if (!isClosable(senderId)) {
      return { ok: false, error: 'This window is not allowed to close itself' };
    }
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.close();
    }
    return { ok: true };
  });
}

export function registerQuickCaptureShortcut(): void {
  const registered = globalShortcut.register('CommandOrControl+Shift+N', () => {
    createQuickCaptureWindow();
  });
  if (!registered) {
    getLogger().warn(
      'Failed to register global shortcut CommandOrControl+Shift+N — already in use?'
    );
  }
}

export { createMainWindow, createNoteWindow, createQuickCaptureWindow, createSettingsWindow };
