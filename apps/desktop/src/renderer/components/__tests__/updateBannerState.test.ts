import { describe, expect, it } from 'vitest';
import { updaterBannerErrorKind } from '../updateBannerState';

describe('updaterBannerErrorKind', () => {
  it('retries install when the banner was ready to install', () => {
    expect(updaterBannerErrorKind('ready')).toBe('install-error');
    expect(updaterBannerErrorKind('install-error')).toBe('install-error');
  });

  it('retries download for download-time failures', () => {
    expect(updaterBannerErrorKind('available')).toBe('download-error');
    expect(updaterBannerErrorKind('downloading')).toBe('download-error');
    expect(updaterBannerErrorKind('download-error')).toBe('download-error');
  });
});
