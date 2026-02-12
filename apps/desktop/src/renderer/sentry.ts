/**
 * Sentry Error Tracking - Renderer Process
 *
 * Initialize Sentry in the renderer process for React errors.
 */

import * as Sentry from '@sentry/electron/renderer';

// Must match the DSN in main process
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';

export function initSentry(): void {
  // Skip if no DSN configured
  if (!SENTRY_DSN) {
    console.log('[Sentry] No DSN configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,

    // Integrations for React
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Mask all text for privacy
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Performance monitoring sample rate
    tracesSampleRate: 0.1,

    // Session replay sample rate
    replaysSessionSampleRate: 0.0, // Don't record normal sessions
    replaysOnErrorSampleRate: 1.0, // Record all sessions with errors
  });

  console.log('[Sentry] Initialized for renderer process');
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
 * Set user context (for tracking user-specific errors)
 */
export function setUser(id: string): void {
  if (SENTRY_DSN) {
    Sentry.setUser({ id });
  }
}

/**
 * Clear user context
 */
export function clearUser(): void {
  if (SENTRY_DSN) {
    Sentry.setUser(null);
  }
}
