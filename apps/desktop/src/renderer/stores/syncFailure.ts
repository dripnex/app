import type { SyncStatus } from './syncStore';

/** Mirrors SyncResult.failure from the main process. The store does not re-read the message. */
export type SyncFailureKind = 'needs-setup' | 'auth-expired' | 'offline' | 'error';

export function manualSyncPresentation(
  failure: SyncFailureKind | undefined,
  message: string | undefined
): { status: SyncStatus; error: string } {
  const raw = message?.trim() || 'Sync failed';
  switch (failure) {
    case 'offline':
      return {
        status: 'offline',
        error: 'No internet connection. Sync will resume when online.',
      };
    case 'auth-expired':
      return { status: 'auth-expired', error: 'Session expired. Please sign in again.' };
    case 'needs-setup':
      return { status: 'needs-setup', error: raw };
    default:
      return { status: 'error', error: raw };
  }
}
