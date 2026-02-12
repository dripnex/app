/**
 * Sentry Error Tracking - Main Process
 *
 * Initialize Sentry as early as possible in the main process.
 * Get your DSN from https://sentry.io
 */

import * as Sentry from '@sentry/electron/main';
import { app } from 'electron';

// Set to your Sentry DSN (from sentry.io project settings)
const SENTRY_DSN = process.env.SENTRY_DSN || '';

export function initSentry(): void {
  // Skip if no DSN configured
  if (!SENTRY_DSN) {
    console.warn('[Sentry] No DSN configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    release: `readied@${app.getVersion()}`,
    environment: app.isPackaged ? 'production' : 'development',

    // Only send errors in production
    enabled: app.isPackaged,

    // Sample rate for performance monitoring (0.0 to 1.0)
    tracesSampleRate: 0.1,

    // Filter out non-critical errors
    beforeSend(event) {
      // Don't send errors in development
      if (!app.isPackaged) {
        return null;
      }
      return event;
    },
  });

  console.warn('[Sentry] Initialized for main process');
}

/**
 * Capture an exception manually
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message: string, data?: Record<string, unknown>): void {
  if (SENTRY_DSN) {
    Sentry.addBreadcrumb({
      message,
      data,
      level: 'info',
    });
  }
}
