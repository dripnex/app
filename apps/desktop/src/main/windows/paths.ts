import { join } from 'path';
import { app, type WebPreferences } from 'electron';
import { PACKAGED_ARGV_FLAG } from '../../shared/playwrightAuthBypass.js';

/** electron-vite emits a single `out/main/index.js`, so __dirname is `out/main`. */
export function rendererPreloadPath(): string {
  return join(__dirname, '../preload/index.js');
}

export function rendererHtmlPath(): string {
  return join(__dirname, '../renderer/index.html');
}

/** Shared renderer prefs. Packaged flag is argv so preload can refuse DRIPNEX_E2E. */
export function rendererWebPreferences(): WebPreferences {
  return {
    preload: rendererPreloadPath(),
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: false,
    additionalArguments: [app.isPackaged ? PACKAGED_ARGV_FLAG : '--dripnex-packaged=0'],
  };
}
