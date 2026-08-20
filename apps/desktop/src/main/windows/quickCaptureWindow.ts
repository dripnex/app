import { BrowserWindow, screen } from 'electron';
import { loadDevRenderer, rendererDevBase } from '../devRenderer.js';
import { resolveAppIconPath } from './icons.js';
import { rendererHtmlPath, rendererPreloadPath } from './paths.js';
import { forgetClosable, trackClosable } from './closable.js';
import { frostedWindowOptions, wireFrosted } from './vibrancy.js';

let quickCaptureWindow: BrowserWindow | null = null;

export function createQuickCaptureWindow(): BrowserWindow {
  if (quickCaptureWindow && !quickCaptureWindow.isDestroyed()) {
    quickCaptureWindow.show();
    quickCaptureWindow.focus();
    return quickCaptureWindow;
  }

  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const { x, y, width, height } = display.workArea;
  const winWidth = 480;
  const winHeight = 340;

  quickCaptureWindow = new BrowserWindow({
    x: Math.round(x + (width - winWidth) / 2),
    y: Math.round(y + (height - winHeight) / 2),
    width: winWidth,
    height: winHeight,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    icon: resolveAppIconPath(),
    ...frostedWindowOptions(),
    webPreferences: {
      preload: rendererPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  wireFrosted(quickCaptureWindow);

  const quickCaptureId = quickCaptureWindow.webContents.id;
  trackClosable(quickCaptureId);

  quickCaptureWindow.on('ready-to-show', () => {
    if (!quickCaptureWindow || quickCaptureWindow.isDestroyed()) return;
    quickCaptureWindow.show();
  });

  quickCaptureWindow.on('closed', () => {
    forgetClosable(quickCaptureId);
    quickCaptureWindow = null;
  });

  const devBase = rendererDevBase();
  if (devBase) {
    void loadDevRenderer(quickCaptureWindow, `${devBase}?view=quick-capture`);
  } else {
    void quickCaptureWindow.loadFile(rendererHtmlPath(), {
      query: { view: 'quick-capture' },
    });
  }

  return quickCaptureWindow;
}
