import { describe, expect, it } from 'vitest';
import { formatUpdaterError, notEnoughSpaceMessage } from '../updaterError';

describe('formatUpdaterError', () => {
  it('names a disk-full ShipIt ditto failure', () => {
    expect(
      formatUpdaterError(
        'ditto: core_bg.wasm: No space left on device\nditto: Could not read pkzip signature.'
      )
    ).toBe('Not enough disk space to install the update. Free about 1 GB and try again.');
  });

  it('names a truncated zip', () => {
    expect(formatUpdaterError('ditto: Could not read pkzip signature.')).toBe(
      'The downloaded update is incomplete. Download it again.'
    );
  });

  it('passes other updater errors through', () => {
    expect(formatUpdaterError('net::ERR_INTERNET_DISCONNECTED')).toBe(
      'net::ERR_INTERNET_DISCONNECTED'
    );
  });
});

describe('notEnoughSpaceMessage', () => {
  it('includes the free megabytes', () => {
    expect(notEnoughSpaceMessage(774 * 1024 * 1024)).toMatch(/774 MB free/);
  });
});
