import { BrowserWindow } from 'electron';
import { loadDevRenderer, rendererDevBase } from '../devRenderer.js';
import { resolveAppIconPath } from './icons.js';
import { rendererHtmlPath, rendererPreloadPath } from './paths.js';
import { frostedWindowOptions } from './vibrancy.js';

export function createNoteWindow(noteId: string, noteTitle: string): BrowserWindow {
  const noteWindow = new BrowserWindow({
    width: 800,
    height: 700,
    minWidth: 500,
    minHeight: 400,
    show: false,
    icon: resolveAppIconPath(),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 8, y: 8 },
    ...frostedWindowOptions(),
    title: noteTitle || 'Note',
    webPreferences: {
      preload: rendererPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  noteWindow.on('ready-to-show', () => {
    if (noteWindow.isDestroyed()) return;
    noteWindow.show();
    if (process.env.NODE_ENV === 'development') {
      noteWindow.webContents.openDevTools();
    }
  });

  const query = `?noteWindow=${encodeURIComponent(noteId)}`;
  const devBase = rendererDevBase();
  if (devBase) {
    void loadDevRenderer(noteWindow, `${devBase}${query}`);
  } else {
    void noteWindow.loadFile(rendererHtmlPath(), {
      query: { noteWindow: noteId },
    });
  }

  return noteWindow;
}
