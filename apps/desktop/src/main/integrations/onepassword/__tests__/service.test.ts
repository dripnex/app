import { describe, expect, it } from 'vitest';
import { formatRecoveryKeyDashed, mapOnePasswordError, pickPreferredVault } from '../service';

describe('onepassword service', () => {
  it('prefers Personal/Private/Employee vaults', () => {
    expect(
      pickPreferredVault([
        { id: '1', title: 'Shared' },
        { id: '2', title: 'Private' },
        { id: '3', title: 'Work' },
      ])
    ).toEqual({ id: '2', title: 'Private' });
    expect(pickPreferredVault([{ id: '1', title: 'Work' }])).toEqual({ id: '1', title: 'Work' });
    expect(pickPreferredVault([])).toBeNull();
  });

  it('formats recovery keys with dashes', () => {
    expect(formatRecoveryKeyDashed('aabbccddeeff0011')).toBe('aabb-ccdd-eeff-0011');
    expect(formatRecoveryKeyDashed('AABB-ccdd')).toBe('aabb-ccdd');
  });

  it('maps 1Password errors without leaking internals', () => {
    expect(mapOnePasswordError(new Error('user cancelled authorization'))).toMatch(/cancelled/i);
    expect(mapOnePasswordError(new Error('could not connect to desktop app'))).toMatch(/unlock/i);
    expect(mapOnePasswordError(new Error('account not found'))).toMatch(/sidebar/i);
    expect(mapOnePasswordError(new Error('developer integration disabled'))).toMatch(/Developer/i);
  });
});
