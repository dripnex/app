/**
 * Update IPC Handlers
 *
 * Handles manual update checks, download, install, and auto-updater event listeners.
 */

import { BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { loggers } from '../logger';
import type { BroadcastFn } from './types.js';

export interface UpdateHandlerDeps {
  broadcastToWindows: BroadcastFn;
}

export function registerUpdateHandlers(_deps: UpdateHandlerDeps): void {
  // Manual check for updates
  ipcMain.handle(
    'updates:checkNow',
    async (): Promise<{ available: boolean; version?: string }> => {
      // In development or without proper updater config, return mock response
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
    }
  );

  ipcMain.handle('updates:startDownload', async () => {
    if (process.env.NODE_ENV === 'development') return { ok: false };
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (err) {
      const message = (err as Error).message;
      loggers.updater().error({ error: message }, 'Failed to download update');
      return { ok: false, error: message };
    }
  });

  ipcMain.handle('updates:installNow', () => {
    // Force-close all windows so macOS doesn't block the quit
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) win.destroy();
    });
    autoUpdater.quitAndInstall(false, true);
  });
}

/** Initialize auto-updater event listeners and first check */
export function initAutoUpdater(deps: UpdateHandlerDeps): void {
  const updateLog = loggers.updater();

  // Only check for updates in production
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

  // Check for updates after a short delay
  setTimeout(() => {
    void autoUpdater.checkForUpdates();
  }, 3000);
}
