/**
 * Logger Module for Electron Main Process
 *
 * Provides structured logging with pino to file and console.
 * Log rotation is handled by pino-roll.
 */

import { join } from 'path';
import { app } from 'electron';
import pino, { type Logger, type TransportTargetOptions } from 'pino';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerConfig {
  logsDir: string;
  level: LogLevel;
  isDevelopment: boolean;
}

let logger: Logger | null = null;

/**
 * Initialize the application logger.
 * Must be called after app.getPath('userData') is available.
 */
export function initLogger(config: LoggerConfig): Logger {
  const { logsDir, level, isDevelopment } = config;

  // File transport configuration using pino-roll
  const fileTransport: TransportTargetOptions = {
    target: 'pino-roll',
    options: {
      file: join(logsDir, 'readied'),
      frequency: 'daily',
      limit: { count: 7 },
      size: '10m',
      mkdir: true,
      extension: '.log',
    },
    level,
  };

  // Console transport for development
  const consoleTransport: TransportTargetOptions = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
    level,
  };

  const baseConfig = {
    app: 'readied',
    version: app.getVersion(),
    pid: process.pid,
  };

  if (isDevelopment) {
    // Development: both console (pretty) and file
    logger = pino(
      {
        level,
        base: baseConfig,
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      pino.transport({
        targets: [consoleTransport, fileTransport],
      })
    );
  } else {
    // Production: file only
    logger = pino(
      {
        level,
        base: baseConfig,
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      pino.transport({
        targets: [fileTransport],
      })
    );
  }

  return logger;
}

/**
 * Get the current logger instance.
 * Throws if logger not initialized.
 */
export function getLogger(): Logger {
  if (!logger) {
    throw new Error('Logger not initialized. Call initLogger first.');
  }
  return logger;
}

/**
 * Create a child logger with additional context.
 */
export function createChildLogger(context: Record<string, unknown>): Logger {
  return getLogger().child(context);
}

/**
 * Convenience loggers for specific components.
 */
export const loggers = {
  main: () => createChildLogger({ component: 'main' }),
  database: () => createChildLogger({ component: 'database' }),
  ipc: () => createChildLogger({ component: 'ipc' }),
  updater: () => createChildLogger({ component: 'updater' }),
  license: () => createChildLogger({ component: 'license' }),
  renderer: () => createChildLogger({ component: 'renderer' }),
};
