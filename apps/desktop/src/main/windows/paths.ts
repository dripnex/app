import { join } from 'path';

/** electron-vite emits a single `out/main/index.js`, so __dirname is `out/main`. */
export function rendererPreloadPath(): string {
  return join(__dirname, '../preload/index.js');
}

export function rendererHtmlPath(): string {
  return join(__dirname, '../renderer/index.html');
}
