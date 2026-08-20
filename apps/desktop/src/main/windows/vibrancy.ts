import { BrowserWindow, type BrowserWindowConstructorOptions, type View } from 'electron';

/**
 * Native frosted chrome.
 *
 * On macOS 26 / Electron 30+ this only works if transparency is granted
 * *at construction* (`transparent: true`). setVibrancy after the fact on
 * an opaque window is a no-op — the WebContentsView stays a solid fill.
 *
 * Window `backgroundColor` alpha is ignored unless transparent is true
 * (#AARRGGBB). The view tree must also be cleared: BrowserWindow's
 * contentView is a container; the WebContentsView child defaults to white.
 *
 * CSS backdrop-filter cannot see the desktop. Docked DevTools paints opaque.
 */
const FROSTED = new WeakMap<BrowserWindow, boolean>();
const WIRED = new WeakSet<BrowserWindow>();

const CLEAR = '#00000000';
const OPAQUE = '#0a0b0d';

/** Last value from `window:setFrosted`. New windows start from this. */
let lastFrosted = true;

export function preferredFrosted(): boolean {
  return lastFrosted;
}

export function rememberFrosted(on: boolean): void {
  lastFrosted = on;
}

function paintViewTree(view: View | undefined, color: string): void {
  if (!view) return;
  try {
    view.setBackgroundColor(color);
  } catch {
    return;
  }
  for (const child of view.children ?? []) paintViewTree(child, color);
}

export function frostedWindowOptions(): Pick<
  BrowserWindowConstructorOptions,
  | 'transparent'
  | 'backgroundColor'
  | 'vibrancy'
  | 'visualEffectState'
  | 'backgroundMaterial'
  | 'hasShadow'
> {
  if (process.platform === 'darwin') {
    return {
      transparent: true,
      backgroundColor: CLEAR,
      vibrancy: 'under-window',
      visualEffectState: 'active',
      hasShadow: true,
    };
  }
  if (process.platform === 'win32') {
    return {
      transparent: true,
      backgroundColor: CLEAR,
      backgroundMaterial: 'acrylic',
    };
  }
  return { backgroundColor: OPAQUE };
}

export function applyFrosted(win: BrowserWindow, on: boolean): void {
  if (win.isDestroyed()) return;
  FROSTED.set(win, on);

  if (process.platform === 'linux') {
    win.setBackgroundColor(OPAQUE);
    return;
  }

  if (process.platform === 'darwin') {
    win.setVibrancy(on ? 'under-window' : null);
  } else if (process.platform === 'win32') {
    win.setBackgroundMaterial(on ? 'acrylic' : 'none');
  }

  win.setBackgroundColor(on ? CLEAR : OPAQUE);
  paintViewTree(win.contentView, on ? CLEAR : OPAQUE);
}

export function wireFrosted(win: BrowserWindow, initial = lastFrosted): void {
  applyFrosted(win, initial);
  if (WIRED.has(win)) return;
  WIRED.add(win);
  const reapply = () => applyFrosted(win, FROSTED.get(win) ?? initial);
  win.webContents.on('did-finish-load', reapply);
  win.webContents.on('did-navigate', reapply);
  win.webContents.on('devtools-closed', reapply);
}
