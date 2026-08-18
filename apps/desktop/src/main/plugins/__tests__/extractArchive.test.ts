import { describe, expect, it } from 'vitest';
import { isSafeArchiveEntry } from '../extractArchive.js';

describe('isSafeArchiveEntry', () => {
  it('accepts a nested plugin file', () => {
    expect(isSafeArchiveEntry('plugin-stamp/manifest.json')).toBe(true);
    expect(isSafeArchiveEntry('src/index.js')).toBe(true);
  });

  it('rejects zip-slip and absolute paths', () => {
    expect(isSafeArchiveEntry('../evil.js')).toBe(false);
    expect(isSafeArchiveEntry('ok/../../etc/passwd')).toBe(false);
    expect(isSafeArchiveEntry('/etc/passwd')).toBe(false);
    expect(isSafeArchiveEntry('C:\\Windows\\system.ini')).toBe(false);
  });
});
