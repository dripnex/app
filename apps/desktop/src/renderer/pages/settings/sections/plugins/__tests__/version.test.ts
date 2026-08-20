import { describe, it, expect } from 'vitest';
import { versionNewer } from '../version';

describe('versionNewer', () => {
  it('detects a patch bump', () => {
    expect(versionNewer('0.1.1', '0.1.0')).toBe(true);
    expect(versionNewer('0.1.0', '0.1.1')).toBe(false);
  });

  it('treats equal versions as not newer', () => {
    expect(versionNewer('1.0.0', '1.0.0')).toBe(false);
  });

  it('strips a leading v', () => {
    expect(versionNewer('v2.0.0', '1.9.0')).toBe(true);
  });
});
