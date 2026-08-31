/**
 * Update IPC Handlers
 *
 * Handles manual update checks, download, install, and auto-updater event listeners.
 */

import { app, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { z } from 'zod';
import { abortAllStreams } from '../ai/ipc-ai.js';
import { defineIpcHandler } from '../ipc/registry.js';
import { loggers } from '../logger';
import type { BroadcastFn } from './types.js';
import {
  UPDATE_INSTALL_FREE_BYTES,
  formatUpdaterError,
  freeBytesAt,
  notEnoughSpaceMessage,
} from './updaterError.js';

export interface UpdateHandlerDeps {
  broadcastToWindows: BroadcastFn;
}

let installingUpdate = false;

export function isInstallingUpdate(): boolean {
  return installingUpdate;
}

function diskGuard(): string | null {
  try {
    const free = freeBytesAt(app.getPath('temp'));
    if (free < UPDATE_INSTALL_FREE_BYTES) return notEnoughSpaceMessage(free);
  } catch {
    return null;
  }
  return null;
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
      const space = diskGuard();
      if (space) return { ok: false, error: space };
      try {
        await autoUpdater.downloadUpdate();
        return { ok: true };
      } catch (err) {
        const message = formatUpdaterError((err as Error).message);
        loggers.updater().error({ error: message }, 'Failed to download update');
        return { ok: false, error: message };
      }
    },
  });

  ipcMain.handle('updates:installNow', (): { ok: boolean; error?: string } => {
    const space = diskGuard();
    if (space) return { ok: false, error: space };

    abortAllStreams();
    installingUpdate = true;
    // Do not destroy windows first. If ShipIt fails (disk full, bad zip)
    // the user still has a window and the error event can land.
    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true);
    });
    return { ok: true };
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
    installingUpdate = false;
    const message = formatUpdaterError(err.message);
    updateLog.error({ error: err.message }, 'Updater error');
    deps.broadcastToWindows('updates:error', { message });
  });

  setTimeout(() => {
    void autoUpdater.checkForUpdates();
  }, 3000);
}
