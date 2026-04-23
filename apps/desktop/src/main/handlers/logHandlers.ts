/**
 * Log IPC Handlers
 *
 * Handles renderer-side logging via IPC.
 */

import { ipcMain } from 'electron';
import { createChildLogger, type LogLevel } from '../logger';
import type { DataPaths } from './types.js';

export interface LogHandlerDeps {
  /** May be null if data paths aren't initialized yet */
  getDataPaths: () => DataPaths | null;
}

export function registerLogHandlers(deps: LogHandlerDeps): void {
  const rendererLogger = createChildLogger({ component: 'renderer' });

  // Log from renderer
  ipcMain.handle(
    'log:write',
    async (
      _event,
      level: LogLevel,
      message: string,
      context?: Record<string, unknown>
    ): Promise<{ success: boolean }> => {
      const childLogger = context ? rendererLogger.child(context) : rendererLogger;

      switch (level) {
        case 'debug':
          childLogger.debug(message);
          break;
        case 'info':
          childLogger.info(message);
          break;
        case 'warn':
          childLogger.warn(message);
          break;
        case 'error':
          childLogger.error(message);
          break;
      }

      return { success: true };
    }
  );

  // Get log file path (for debugging/support)
  ipcMain.handle('log:getPath', async (): Promise<string | null> => {
    return deps.getDataPaths()?.logs ?? null;
  });
}
