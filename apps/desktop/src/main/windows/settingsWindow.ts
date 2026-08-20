import { BrowserWindow } from 'electron';
import { loadDevRenderer, rendererDevBase } from '../devRenderer.js';
import { resolveAppIconPath } from './icons.js';
import { rendererHtmlPath, rendererPreloadPath } from './paths.js';
import { forgetClosable, trackClosable } from './closable.js';
import { frostedWindowOptions, wireFrosted } from './vibrancy.js';

let settingsWindow: BrowserWindow | null = null;

export function createSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    show: false,
    icon: resolveAppIconPath(),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 8, y: 8 },
    ...frostedWindowOptions(),
    title: 'Settings',
    webPreferences: {
      preload: rendererPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  wireFrosted(settingsWindow);

  const settingsId = settingsWindow.webContents.id;
  trackClosable(settingsId);

  settingsWindow.on('ready-to-show', () => {
    if (!settingsWindow || settingsWindow.isDestroyed()) return;
    settingsWindow.show();
  });

  settingsWindow.on('closed', () => {
    forgetClosable(settingsId);
    settingsWindow = null;
  });

  const devBase = rendererDevBase();
  if (devBase) {
    void loadDevRenderer(settingsWindow, `${devBase}?view=settings`);
  } else {
    void settingsWindow.loadFile(rendererHtmlPath(), {
      query: { view: 'settings' },
    });
  }

  return settingsWindow;
}
