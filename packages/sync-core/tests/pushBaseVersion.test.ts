import { describe, expect, it } from 'vitest';
import { pushBaseVersion } from '../src/pushBaseVersion';

describe('pushBaseVersion', () => {
  it('omits a base the client has never stored', () => {
    expect(pushBaseVersion(0)).toBeUndefined();
    expect(pushBaseVersion(null)).toBeUndefined();
    expect(pushBaseVersion(undefined)).toBeUndefined();
  });

  it('sends the sync-log version last applied to this row', () => {
    expect(pushBaseVersion(101)).toBe(101);
    expect(pushBaseVersion(4.8)).toBe(4);
  });
});
