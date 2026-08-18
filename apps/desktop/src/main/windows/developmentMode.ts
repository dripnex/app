/**
 * Development Mode — Inkdrop-style Inspect Element.
 *
 * Always provides a basic edit context menu. When enabled (or in
 * electron-vite dev), also offers Inspect Element and Toggle DevTools.
 */

import { app, BrowserWindow, Menu } from 'electron';
import type { WebContents } from 'electron';

const isDevProcess = process.env.NODE_ENV === 'development';

let userEnabled = false;
const attached = new WeakSet<WebContents>();

export function isDevelopmentMode(): boolean {
  return userEnabled || isDevProcess;
}

export function setDevelopmentMode(on: boolean): void {
  userEnabled = on;
  if (!on && !isDevProcess) {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
        win.webContents.closeDevTools();
      }
    }
  }
}

export function attachContextMenu(win: BrowserWindow): void {
  const wc = win.webContents;
  if (attached.has(wc)) return;
  attached.add(wc);

  wc.on('context-menu', (_event, params) => {
    const inspect = isDevelopmentMode();
    const template: Electron.MenuItemConstructorOptions[] = [
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ];
    if (inspect) {
      template.push(
        { type: 'separator' },
        {
          label: 'Inspect Element',
          click: () => wc.inspectElement(params.x, params.y),
        },
        {
          label: wc.isDevToolsOpened() ? 'Hide Developer Tools' : 'Toggle Developer Tools',
          accelerator: 'Alt+CmdOrCtrl+I',
          click: () => wc.toggleDevTools(),
        }
      );
    }
    Menu.buildFromTemplate(template).popup({ window: win });
  });
}

export function registerDevelopmentMode(): void {
  app.on('browser-window-created', (_event, win) => {
    attachContextMenu(win);
  });
}

export function applyDevelopmentModeFromSettings(settings: unknown): void {
  if (!settings || typeof settings !== 'object') return;
  const general = (settings as { general?: { developmentMode?: unknown } }).general;
  if (typeof general?.developmentMode === 'boolean') {
    setDevelopmentMode(general.developmentMode);
  }
}
