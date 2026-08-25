import { describe, expect, it } from 'vitest';
import {
  githubRepoFromUrl,
  isDripnexPackRepository,
  isOfficialLookingCatalogCard,
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
    expect(
      isTrustedFirstPartyBundleUrl(
        'https://github.com/dripnex/Theme-limestone/releases/download/v0.1.0/theme-limestone-0.1.0.tar.gz'
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
    expect(isDripnexPackRepository('dripnex/Theme-limestone')).toBe(true);
    expect(isDripnexPackRepository('Dripnex/PLUGIN-vim')).toBe(true);
    expect(isDripnexPackRepository('attacker/theme-limestone')).toBe(false);
    expect(isDripnexPackRepository('dripnex/app')).toBe(false);
  });
});

describe('githubRepoFromUrl', () => {
  it('parses github.com owner/repo via hostname, not substring', () => {
    expect(githubRepoFromUrl('https://github.com/dripnex/theme-limestone')).toBe(
      'dripnex/theme-limestone'
    );
    expect(githubRepoFromUrl('https://github.com/dripnex/plugin-vim.git')).toBe(
      'dripnex/plugin-vim'
    );
    expect(githubRepoFromUrl('https://github.com.evil.example/dripnex/theme-limestone')).toBeNull();
    expect(githubRepoFromUrl('https://attacker.example/dripnex/theme-limestone')).toBeNull();
  });
});

describe('isOfficialLookingCatalogCard', () => {
  it('treats a dripnex pack repository as official even when the slug is not reserved', () => {
    expect(isOfficialLookingCatalogCard('limestone', 'dripnex/theme-limestone')).toBe(true);
    expect(isOfficialLookingCatalogCard('limestone', 'dripnex/Theme-limestone')).toBe(true);
    expect(isOfficialLookingCatalogCard('hello-notes', 'acme/hello-notes')).toBe(false);
    expect(isOfficialLookingCatalogCard('theme-limestone', null)).toBe(true);
  });
});
