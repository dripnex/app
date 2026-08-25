/**
 * Application menu. Built-ins use Electron roles.
 * Plugins contribute items under Plugins via IPC.
 */

import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import { openUserHackFile } from '../userHackFiles.js';
import { createSettingsWindow } from './settingsWindow.js';
import { fileMenuSlots } from './menuLayout.js';

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

function settingsMenuItem(): MenuItemConstructorOptions {
  return {
    label: 'Settings…',
    accelerator: 'CommandOrControl+,',
    click: () => {
      createSettingsWindow();
    },
  };
}

function fileMenu(): MenuItemConstructorOptions {
  const items: MenuItemConstructorOptions[] = fileMenuSlots(process.platform).map(slot => {
    if (slot === 'settings') return settingsMenuItem();
    if (slot === 'separator') return { type: 'separator' };
    if (slot === 'close') return { role: 'close' };
    return { role: 'quit' };
  });
  return { label: 'File', submenu: items };
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
    ...(contributed.length > 0 ? contributed : [{ label: 'No plugin commands', enabled: false }]),
  ];

  const darwinAppMenu: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      settingsMenuItem(),
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  };

  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [darwinAppMenu] : []),
    fileMenu(),
    {
      label: 'Note',
      submenu: [
        {
          label: 'Export as Markdown…',
          click: (_item, browserWindow) => {
            invokeIn(
              targetWindow(browserWindow) ?? undefined,
              'plugin:dripnex-export-markdown:export-file'
            );
          },
        },
        {
          label: 'Export as HTML…',
          click: (_item, browserWindow) => {
            invokeIn(
              targetWindow(browserWindow) ?? undefined,
              'plugin:dripnex-export-markdown:export-html'
            );
          },
        },
        {
          label: 'Export as PDF…',
          click: (_item, browserWindow) => {
            invokeIn(
              targetWindow(browserWindow) ?? undefined,
              'plugin:dripnex-export-markdown:export-pdf'
            );
          },
        },
        { type: 'separator' },
        {
          label: 'Print…',
          click: (_item, browserWindow) => {
            invokeIn(
              targetWindow(browserWindow) ?? undefined,
              'plugin:dripnex-export-markdown:print'
            );
          },
        },
      ],
    },
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
