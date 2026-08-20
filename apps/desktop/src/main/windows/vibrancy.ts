import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron';

/**
 * Native frosted chrome — the desktop shows through the window.
 *
 * CSS `backdrop-filter` only blurs in-page pixels. On macOS the real
 * effect is NSVisualEffectView (`vibrancy: 'under-window'`).
 *
 * Electron docs: window `backgroundColor` alpha (#AARRGGBB) is ignored
 * unless `transparent: true`. `#00000000` without that flag paints
 * opaque black over the vibrancy. Do not set a window backgroundColor
 * while frosted. Clear the Electron 30+ WebContentsView fill instead
 * (`contentView.setBackgroundColor('#00000000')` — View alpha works).
 *
 * `transparent: true` is also off: it drops the native shadow and can
 * freeze resize. Docked DevTools paints the page opaque.
 */
const FROSTED = new WeakMap<BrowserWindow, boolean>();
const WIRED = new WeakSet<BrowserWindow>();

const VIEW_CLEAR = '#00000000';
const OPAQUE = '#0a0b0d';

export function frostedWindowOptions(): Pick<
  BrowserWindowConstructorOptions,
  'vibrancy' | 'visualEffectState' | 'backgroundMaterial'
> {
  if (process.platform === 'darwin') {
    return {
      vibrancy: 'under-window',
      visualEffectState: 'active',
    };
  }
  if (process.platform === 'win32') {
    return { backgroundMaterial: 'acrylic' };
  }
  return {};
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

  if (!on) {
    win.setBackgroundColor(OPAQUE);
  }

  try {
    win.contentView?.setBackgroundColor(on ? VIEW_CLEAR : OPAQUE);
  } catch {
    /* View.setBackgroundColor is Electron 30+ */
  }
}

/** Constructor options plus load/DevTools re-apply. Call once per window. */
export function wireFrosted(win: BrowserWindow, initial = true): void {
  applyFrosted(win, initial);
  if (WIRED.has(win)) return;
  WIRED.add(win);
  const reapply = () => applyFrosted(win, FROSTED.get(win) ?? initial);
  win.webContents.on('did-finish-load', reapply);
  win.webContents.on('devtools-closed', reapply);
}
