import { describe, expect, it } from 'vitest';
import { syncFooterAction, syncFooterErrorLabel } from '../syncFooterCopy';

const base = {
  encryptionReady: null as boolean | null,
  status: 'error' as const,
  error: null as string | null,
  consecutiveFailures: 0,
};

describe('syncFooterAction', () => {
  it('never offers Retry without a CEK', () => {
    expect(syncFooterAction({ ...base, encryptionReady: false })).toBe('setup');
    expect(
      syncFooterAction({
        ...base,
        encryptionReady: null,
        error: 'Encryption not ready. Set up a passphrase in Settings.',
      })
    ).toBe('setup');
    expect(
      syncFooterAction({
        ...base,
        encryptionReady: false,
        consecutiveFailures: 4,
      })
    ).toBe('setup');
  });

  it('offers Retry only when a CEK is loaded', () => {
    expect(syncFooterAction({ ...base, encryptionReady: true })).toBe('retry');
    expect(
      syncFooterAction({
        ...base,
        encryptionReady: true,
        status: 'idle',
        consecutiveFailures: 2,
      })
    ).toBe('retry');
    expect(
      syncFooterAction({
        ...base,
        encryptionReady: true,
        status: 'idle',
        consecutiveFailures: 0,
      })
    ).toBeNull();
  });
});

describe('syncFooterErrorLabel', () => {
  it('says Set up encryption when there is no CEK', () => {
    expect(syncFooterErrorLabel({ ...base, encryptionReady: false })).toBe('Set up encryption');
  });
});
