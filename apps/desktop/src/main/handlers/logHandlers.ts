/**
 * Log IPC Handlers
 *
 * Handles renderer-side logging via IPC. Validated at the boundary:
 * level must be one of the enum values; message capped at 16 KiB;
 * context object size is left to JSON serialization limits.
 */

import { z } from 'zod';
import { defineIpcHandler } from '../ipc/registry.js';
import { createChildLogger } from '../logger';
import type { DataPaths } from './types.js';

export interface LogHandlerDeps {
  /** May be null if data paths aren't initialized yet */
  getDataPaths: () => DataPaths | null;
}

const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);
const LogMessageSchema = z.string().max(16384);
const LogContextSchema = z.record(z.string(), z.unknown()).optional();

export function registerLogHandlers(deps: LogHandlerDeps): void {
  const rendererLogger = createChildLogger({ component: 'renderer' });

  defineIpcHandler({
    channel: 'log:write',
    args: z.tuple([LogLevelSchema, LogMessageSchema, LogContextSchema]),
    handler: (level, message, context): { success: boolean } => {
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
    },
  });

  defineIpcHandler({
    channel: 'log:getPath',
    args: z.tuple([]),
    handler: (): string | null => deps.getDataPaths()?.logs ?? null,
  });
}
