/**
 * Plugin Hot Reload Watcher (dev mode only)
 *
 * Watches the plugins directory for file changes and broadcasts
 * a reload event to all renderer windows via IPC.
 * Uses Node's built-in fs.watch with debouncing.
 */

import { watch, type FSWatcher } from 'fs';
import { existsSync } from 'fs';
import { BrowserWindow } from 'electron';

let watcher: FSWatcher | null = null;

/**
 * Start watching the plugins directory for changes.
 * Only call this in development mode.
 */
export function startPluginWatcher(pluginsDir: string): void {
  if (watcher) return; // Already watching

  if (!existsSync(pluginsDir)) {
    console.warn('[pluginWatcher] Plugins directory does not exist, skipping watch:', pluginsDir);
    return;
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const broadcastReload = () => {
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('plugins:reload');
      }
    });
  };

  try {
    watcher = watch(pluginsDir, { recursive: true }, (_eventType, filename) => {
      // Ignore hidden files and temp files
      if (filename && (filename.startsWith('.') || filename.endsWith('~'))) return;

      // Debounce: wait 300ms after last change before reloading
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.warn('[pluginWatcher] Plugin file changed, broadcasting reload');
        broadcastReload();
        debounceTimer = null;
      }, 300);
    });

    console.warn('[pluginWatcher] Watching for plugin changes:', pluginsDir);
  } catch (error) {
    console.error('[pluginWatcher] Failed to start watcher:', error);
  }
}

/**
 * Stop watching the plugins directory.
 */
export function stopPluginWatcher(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
    console.warn('[pluginWatcher] Stopped watching plugins directory');
  }
}
