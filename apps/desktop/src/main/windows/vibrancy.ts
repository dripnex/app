import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron';

/**
 * Native frosted chrome — the desktop shows through the window.
 *
 * CSS `backdrop-filter` only blurs in-page pixels. It cannot see the
 * wallpaper or other apps. On macOS the real effect is an
 * NSVisualEffectView (`vibrancy: 'under-window'`). Windows 11 uses
 * acrylic. Linux has no equivalent; stay opaque.
 *
 * Electron 30+ wraps the page in a WebContentsView that defaults to an
 * opaque white fill. Vibrancy sits *behind* that view, so it is
 * invisible until `contentView.setBackgroundColor('#00000000')`.
 * Navigation and load reset the fill — re-apply after `did-finish-load`.
 *
 * Do not set `transparent: true`: it drops the native shadow and can
 * freeze resize. Docked DevTools paints the page opaque; do not
 * auto-open it while checking Glass.
 */
const FROSTED = new WeakMap<BrowserWindow, boolean>();
const WIRED = new WeakSet<BrowserWindow>();

const CLEAR = '#00000000';
const OPAQUE = '#0a0b0d';

export function frostedWindowOptions(): Pick<
  BrowserWindowConstructorOptions,
  'vibrancy' | 'visualEffectState' | 'backgroundMaterial' | 'backgroundColor'
> {
  if (process.platform === 'darwin') {
    return {
      vibrancy: 'under-window',
      visualEffectState: 'active',
      backgroundColor: CLEAR,
    };
  }
  if (process.platform === 'win32') {
    return {
      backgroundMaterial: 'acrylic',
      backgroundColor: CLEAR,
    };
  }
  return { backgroundColor: OPAQUE };
}

export function applyFrosted(win: BrowserWindow, on: boolean): void {
  if (win.isDestroyed()) return;
  FROSTED.set(win, on);

  if (process.platform === 'darwin') {
    win.setVibrancy(on ? 'under-window' : null);
    win.setBackgroundColor(on ? CLEAR : OPAQUE);
  } else if (process.platform === 'win32') {
    win.setBackgroundMaterial(on ? 'acrylic' : 'none');
    win.setBackgroundColor(on ? CLEAR : OPAQUE);
  } else {
    win.setBackgroundColor(OPAQUE);
    return;
  }

  try {
    win.contentView?.setBackgroundColor(on ? CLEAR : OPAQUE);
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
