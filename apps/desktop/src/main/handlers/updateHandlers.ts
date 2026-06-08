/**
 * Update IPC Handlers
 *
 * Handles manual update checks, download, install, and auto-updater event listeners.
 */

import { BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { z } from 'zod';
import { defineIpcHandler } from '../ipc/registry.js';
import { loggers } from '../logger';
import type { BroadcastFn } from './types.js';

export interface UpdateHandlerDeps {
  broadcastToWindows: BroadcastFn;
}

export function registerUpdateHandlers(_deps: UpdateHandlerDeps): void {
  defineIpcHandler({
    channel: 'updates:checkNow',
    args: z.tuple([]),
    handler: async (): Promise<{ available: boolean; version?: string }> => {
      if (process.env.NODE_ENV === 'development') {
        return { available: false };
      }

      // Event-based pattern: autoUpdater emits events, we wrap in Promise
      return new Promise(resolve => {
        const onAvailable = (info: { version: string }) => {
          cleanup();
          resolve({ available: true, version: info.version });
        };
        const onNotAvailable = () => {
          cleanup();
          resolve({ available: false });
        };
        const onError = () => {
          cleanup();
          resolve({ available: false });
        };
        const cleanup = () => {
          autoUpdater.removeListener('update-available', onAvailable);
          autoUpdater.removeListener('update-not-available', onNotAvailable);
          autoUpdater.removeListener('error', onError);
        };

        autoUpdater.once('update-available', onAvailable);
        autoUpdater.once('update-not-available', onNotAvailable);
        autoUpdater.once('error', onError);

        autoUpdater.checkForUpdates().catch(() => {
          cleanup();
          resolve({ available: false });
        });
      });
    },
  });

  defineIpcHandler({
    channel: 'updates:startDownload',
    args: z.tuple([]),
    handler: async () => {
      if (process.env.NODE_ENV === 'development') return { ok: false };
      try {
        await autoUpdater.downloadUpdate();
        return { ok: true };
      } catch (err) {
        const message = (err as Error).message;
        loggers.updater().error({ error: message }, 'Failed to download update');
        return { ok: false, error: message };
      }
    },
  });

  // installNow doesn't return a value AND triggers a quit — keeping the
  // raw ipcMain.handle is simpler here since registry.ts always wraps in
  // Promise<unknown> and we don't want async semantics interfering with
  // the synchronous window-destruction path.
  ipcMain.handle('updates:installNow', () => {
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) win.destroy();
    });
    autoUpdater.quitAndInstall(false, true);
  });
}

/** Initialize auto-updater event listeners and first check */
export function initAutoUpdater(deps: UpdateHandlerDeps): void {
  const updateLog = loggers.updater();

  if (process.env.NODE_ENV === 'development') {
    updateLog.debug('Skipping auto-updater in development');
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    updateLog.info('Checking for updates...');
  });

  autoUpdater.on('update-available', info => {
    updateLog.info({ version: info.version }, 'Update available');
    deps.broadcastToWindows('updates:available', { version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    updateLog.info('No updates available');
  });

  autoUpdater.on('download-progress', progress => {
    updateLog.debug({ percent: progress.percent.toFixed(1) }, 'Download progress');
    deps.broadcastToWindows('updates:download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', info => {
    updateLog.info({ version: info.version }, 'Update downloaded');
    deps.broadcastToWindows('updates:download-complete', { version: info.version });
  });

  autoUpdater.on('error', err => {
    updateLog.error({ error: err.message }, 'Updater error');
    deps.broadcastToWindows('updates:error', { message: err.message });
  });

  setTimeout(() => {
    void autoUpdater.checkForUpdates();
  }, 3000);
}
