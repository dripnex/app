import { BrowserWindow } from 'electron';
import { loadWindowState, saveWindowState } from '../services/windowState.js';
import { loadDevRenderer, rendererDevBase } from '../devRenderer.js';
import { resolveAppIconPath } from './icons.js';
import { rendererHtmlPath, rendererWebPreferences } from './paths.js';
import { flushPendingAuthToken } from './authDeepLink.js';
import { frostedWindowOptions, wireFrosted } from './vibrancy.js';

export function createMainWindow(): BrowserWindow {
  const windowState = loadWindowState();

  const mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    minWidth: 800,
    minHeight: 600,
    show: false,
    icon: resolveAppIconPath(),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 8, y: 8 },
    ...frostedWindowOptions(),
    webPreferences: rendererWebPreferences(),
  });

  wireFrosted(mainWindow);

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  let saveTimeout: NodeJS.Timeout | null = null;
  const debouncedSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      if (!mainWindow.isDestroyed() && !mainWindow.isMaximized()) {
        saveWindowState({
          ...mainWindow.getBounds(),
          isMaximized: false,
        });
      }
    }, 500);
  };

  mainWindow.on('resize', debouncedSave);
  mainWindow.on('move', debouncedSave);

  mainWindow.on('maximize', () => {
    if (mainWindow.isDestroyed()) return;
    saveWindowState({
      ...mainWindow.getBounds(),
      isMaximized: true,
    });
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow.isDestroyed()) return;
    saveWindowState({
      ...mainWindow.getBounds(),
      isMaximized: false,
    });
  });

  mainWindow.on('ready-to-show', () => {
    if (mainWindow.isDestroyed()) return;
    if (rendererDevBase() && mainWindow.webContents.getURL().startsWith('chrome-error:')) {
      return;
    }
    if (!rendererDevBase()) mainWindow.show();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    flushPendingAuthToken(mainWindow);
  });

  const devBase = rendererDevBase();
  if (devBase) {
    // Docked DevTools paints the page opaque and kills vibrancy.
    void loadDevRenderer(mainWindow, devBase);
  } else {
    void mainWindow.loadFile(rendererHtmlPath());
  }

  return mainWindow;
}
