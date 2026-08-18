/**
 * Application menu. Built-ins use Electron roles.
 * Plugins contribute items under Plugins via IPC.
 */

import { BrowserWindow, Menu, ipcMain } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import { openUserHackFile } from '../userHackFiles.js';

export interface PluginMenuContribution {
  pluginId: string;
  label: string;
  commandId: string;
  accelerator?: string;
}

let pluginItems: PluginMenuContribution[] = [];
let dataRoot: () => string | null = () => null;

function toElectronAccelerator(raw?: string): string | undefined {
  if (!raw) return undefined;
  return raw.replace(/\bMod\b/g, 'CommandOrControl').replace(/\bCmd\b/g, 'Command');
}

function invokeIn(win: BrowserWindow | undefined, commandId: string): void {
  win?.webContents.send('menu:invoke', commandId);
}

function targetWindow(browserWindow: unknown): BrowserWindow | null {
  if (browserWindow instanceof BrowserWindow) return browserWindow;
  return BrowserWindow.getFocusedWindow();
}

function buildTemplate(): MenuItemConstructorOptions[] {
  const contributed: MenuItemConstructorOptions[] = pluginItems.map(item => ({
    label: item.label,
    accelerator: toElectronAccelerator(item.accelerator),
    click: (_menuItem, browserWindow) => {
      invokeIn(targetWindow(browserWindow) ?? undefined, item.commandId);
    },
  }));

  const pluginsSubmenu: MenuItemConstructorOptions[] = [
    {
      label: 'Open Init Script',
      click: () => {
        const root = dataRoot();
        if (root) void openUserHackFile(root, 'init');
      },
    },
    {
      label: 'Open User Stylesheet',
      click: () => {
        const root = dataRoot();
        if (root) void openUserHackFile(root, 'styles');
      },
    },
    {
      label: 'Open Keymap',
      click: () => {
        const root = dataRoot();
        if (root) void openUserHackFile(root, 'keymap');
      },
    },
    {
      label: 'Reload Plugins',
      accelerator: 'Alt+CommandOrControl+R',
      click: () => {
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
            win.webContents.send('plugins:reload');
          }
        }
      },
    },
    { type: 'separator' },
    ...(contributed.length > 0
      ? contributed
      : [{ label: 'No plugin commands', enabled: false }]),
  ];

  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { label: 'Plugins', submenu: pluginsSubmenu },
    { role: 'windowMenu' },
  ];

  return template;
}

export function rebuildApplicationMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildTemplate()));
}

export function registerApplicationMenu(options?: { dataRoot?: () => string | null }): void {
  if (options?.dataRoot) dataRoot = options.dataRoot;
  rebuildApplicationMenu();
  ipcMain.on('menu:setPluginItems', (_event, items: unknown) => {
    if (!Array.isArray(items)) return;
    pluginItems = items.filter(
      (item): item is PluginMenuContribution =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as PluginMenuContribution).label === 'string' &&
        typeof (item as PluginMenuContribution).commandId === 'string'
    );
    rebuildApplicationMenu();
  });
}
