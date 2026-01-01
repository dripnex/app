/**
 * Logger Module for Electron Main Process
 *
 * Provides structured logging with pino.
 * Uses synchronous logging to avoid worker thread complexity with electron-vite.
 */

import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import pino, { type Logger } from 'pino';

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

  const baseConfig = {
    app: 'readied',
    version: app.getVersion(),
    pid: process.pid,
  };

  if (isDevelopment) {
    // Development: synchronous JSON output to stdout
    // Readable and doesn't require worker threads
    logger = pino({
      level,
      base: baseConfig,
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  } else {
    // Production: synchronous file output
    // Create logs directory if needed
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }

    const logFile = join(logsDir, `readied-${new Date().toISOString().split('T')[0]}.log`);
    const stream = createWriteStream(logFile, { flags: 'a' });

    logger = pino(
      {
        level,
        base: baseConfig,
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      stream
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
