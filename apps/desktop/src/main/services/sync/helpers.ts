/**
 * Sync helper utilities.
 */

import { ApiError } from '../apiClient.js';

export const MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Classify an error message as a network error (transient) vs an actual failure.
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('enotfound') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('timeout') ||
    msg.includes('abort')
  );
}

/**
 * Check if an error represents a 401 Unauthorized response.
 */
export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 401;
}
