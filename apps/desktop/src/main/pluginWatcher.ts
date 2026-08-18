/**
 * Plugin + user-file watchers.
 *
 * The plugins directory is watched in development only.
 * init.js, styles.css and keybindings.json in the data root are watched
 * always — saving any of them should feel like hacking the running app.
 */

import { watch, type FSWatcher } from 'fs';
import { existsSync } from 'fs';
import { BrowserWindow } from 'electron';
import { USER_INIT_FILE, USER_KEYMAP_FILE, USER_STYLES_FILE } from './userHackFiles.js';

let pluginDirWatcher: FSWatcher | null = null;
let userFileWatcher: FSWatcher | null = null;

function broadcast(channel: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
        win.webContents.send(channel);
      }
    } catch {
      // Window destroyed between check and send
    }
  }
}

/**
 * Start watching the plugins directory for changes.
 * Only call this in development mode.
 */
export function startPluginWatcher(pluginsDir: string): void {
  if (pluginDirWatcher) return;

  if (!existsSync(pluginsDir)) {
    console.warn('[pluginWatcher] Plugins directory does not exist, skipping watch:', pluginsDir);
    return;
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  try {
    pluginDirWatcher = watch(pluginsDir, { recursive: true }, (_eventType, filename) => {
      if (filename && (filename.startsWith('.') || filename.endsWith('~'))) return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.warn('[pluginWatcher] Plugin file changed, broadcasting reload');
        broadcast('plugins:reload');
        debounceTimer = null;
      }, 300);
    });

    console.warn('[pluginWatcher] Watching for plugin changes:', pluginsDir);
  } catch (error) {
    console.error('[pluginWatcher] Failed to start watcher:', error);
  }
}

/**
 * Watch init.js and styles.css in the data directory.
 * Non-recursive so SQLite writes do not thrash the watcher.
 */
export function startUserFileWatcher(dataRoot: string): void {
  if (userFileWatcher) return;

  if (!existsSync(dataRoot)) {
    console.warn('[pluginWatcher] Data directory does not exist, skipping user-file watch');
    return;
  }

  let initTimer: ReturnType<typeof setTimeout> | null = null;
  let stylesTimer: ReturnType<typeof setTimeout> | null = null;
  let keymapTimer: ReturnType<typeof setTimeout> | null = null;

  try {
    userFileWatcher = watch(dataRoot, (_eventType, filename) => {
      const name = filename?.toString();
      if (name === USER_INIT_FILE) {
        if (initTimer) clearTimeout(initTimer);
        initTimer = setTimeout(() => {
          broadcast('plugins:reload');
          initTimer = null;
        }, 300);
        return;
      }
      if (name === USER_STYLES_FILE) {
        if (stylesTimer) clearTimeout(stylesTimer);
        stylesTimer = setTimeout(() => {
          broadcast('plugins:userStylesChanged');
          stylesTimer = null;
        }, 200);
        return;
      }
      if (name === USER_KEYMAP_FILE) {
        if (keymapTimer) clearTimeout(keymapTimer);
        keymapTimer = setTimeout(() => {
          broadcast('plugins:keymapChanged');
          keymapTimer = null;
        }, 200);
      }
    });
  } catch (error) {
    console.error('[pluginWatcher] Failed to watch user files:', error);
  }
}

export function stopPluginWatcher(): void {
  if (pluginDirWatcher) {
    pluginDirWatcher.close();
    pluginDirWatcher = null;
    console.warn('[pluginWatcher] Stopped watching plugins directory');
  }
  if (userFileWatcher) {
    userFileWatcher.close();
    userFileWatcher = null;
  }
}
