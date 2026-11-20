import { describe, expect, it } from 'vitest';
import { manualSyncPresentation } from '../syncFailure';

describe('manualSyncPresentation', () => {
  it('uses the failure kind the service already chose', () => {
    expect(manualSyncPresentation('auth-expired', 'Session expired')).toEqual({
      status: 'auth-expired',
      error: 'Session expired. Please sign in again.',
    });
    expect(manualSyncPresentation('offline', 'timeout')).toEqual({
      status: 'offline',
      error: 'No internet connection. Sync will resume when online.',
    });
    expect(manualSyncPresentation('needs-setup', 'Set up a passphrase to sync.')).toEqual({
      status: 'needs-setup',
      error: 'Set up a passphrase to sync.',
    });
  });

  it('does not classify a 401 or a timeout by reading the message', () => {
    expect(manualSyncPresentation(undefined, 'Session expired')).toEqual({
      status: 'error',
      error: 'Session expired',
    });
    expect(manualSyncPresentation(undefined, 'timeout')).toEqual({
      status: 'error',
      error: 'timeout',
    });
  });
});
