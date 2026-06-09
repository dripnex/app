/**
 * Window position/size persistence.
 *
 * Saved to `window-state.json` under Electron's `userData` directory so
 * the desktop reopens the last window in the same place across launches.
 *
 * Sync file I/O is intentional — `loadWindowState` is called during
 * window construction before the renderer mounts, and `saveWindowState`
 * runs during window close where event handlers don't await.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

export interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized?: boolean;
}

export const DEFAULT_WINDOW_STATE: WindowState = {
  width: 1200,
  height: 800,
};

function getWindowStatePath(): string {
  return join(app.getPath('userData'), 'window-state.json');
}

export function loadWindowState(): WindowState {
  try {
    const data = readFileSync(getWindowStatePath(), 'utf-8');
    return { ...DEFAULT_WINDOW_STATE, ...JSON.parse(data) };
  } catch {
    return DEFAULT_WINDOW_STATE;
  }
}

export function saveWindowState(state: WindowState): void {
  try {
    writeFileSync(getWindowStatePath(), JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('Failed to save window state:', err);
  }
}
