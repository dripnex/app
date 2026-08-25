import { describe, expect, it } from 'vitest';
import {
  isDripnexPackRepository,
  isReservedFirstPartySlug,
  isTrustedFirstPartyBundleUrl,
} from '../firstPartyPacks';

describe('isReservedFirstPartySlug', () => {
  it('reserves seed plugin slugs and theme-/plugin- packs', () => {
    expect(isReservedFirstPartySlug('stamp')).toBe(true);
    expect(isReservedFirstPartySlug('dripnex-vim-mode')).toBe(true);
    expect(isReservedFirstPartySlug('theme-limestone')).toBe(true);
    expect(isReservedFirstPartySlug('plugin-stamp')).toBe(true);
    expect(isReservedFirstPartySlug('hello-notes')).toBe(false);
  });
});

describe('isTrustedFirstPartyBundleUrl', () => {
  it('accepts dripnex GitHub release tarballs', () => {
    expect(
      isTrustedFirstPartyBundleUrl(
        'https://github.com/dripnex/theme-limestone/releases/download/v0.1.0/theme-limestone-0.1.0.tar.gz'
      )
    ).toBe(true);
    expect(
      isTrustedFirstPartyBundleUrl(
        'https://github.com/dripnex/plugin-stamp/releases/download/v0.1.0/stamp-0.1.0.tar.gz'
      )
    ).toBe(true);
  });

  it('rejects attacker hosts, other orgs, and credentialed URLs', () => {
    expect(
      isTrustedFirstPartyBundleUrl(
        'https://github.com/attacker/theme-limestone/releases/download/v0.1.0/theme-limestone-0.1.0.tar.gz'
      )
    ).toBe(false);
    expect(
      isTrustedFirstPartyBundleUrl(
        'https://github.com/dripnex/app/releases/download/v0.1.0/app-0.1.0.tar.gz'
      )
    ).toBe(false);
    expect(
      isTrustedFirstPartyBundleUrl(
        'https://evil.example/dripnex/theme-limestone/releases/download/v0.1.0/x.tar.gz'
      )
    ).toBe(false);
    expect(
      isTrustedFirstPartyBundleUrl(
        'https://attacker@github.com/dripnex/theme-limestone/releases/download/v0.1.0/x.tar.gz'
      )
    ).toBe(false);
  });
});

describe('isDripnexPackRepository', () => {
  it('matches dripnex theme and plugin satellites', () => {
    expect(isDripnexPackRepository('dripnex/theme-limestone')).toBe(true);
    expect(isDripnexPackRepository('dripnex/plugin-vim')).toBe(true);
    expect(isDripnexPackRepository('attacker/theme-limestone')).toBe(false);
    expect(isDripnexPackRepository('dripnex/app')).toBe(false);
  });
});
