import { describe, expect, it } from 'vitest';
import {
  COMMUNITY_CATALOG,
  githubRepoFromUrl,
  installSpecFor,
  matchRemoteForInstalled,
  mergeFallbackCatalog,
} from '../communityCatalog';

describe('installSpecFor', () => {
  it('uses the GitHub repo, not the manifest id', () => {
    const vim = COMMUNITY_CATALOG.find(p => p.id === 'dripnex-vim-mode');
    expect(vim?.repository).toBe('dripnex/plugin-vim');
    expect(installSpecFor({ slug: vim!.id, repository: vim!.repository })).toBe(
      'dripnex/plugin-vim'
    );
  });

  it('fills the catalog repo when the live card omitted repositoryUrl', () => {
    expect(installSpecFor({ slug: 'dripnex-vim-mode', repository: null })).toBe(
      'dripnex/plugin-vim'
    );
  });

  it('falls back to the slug only for packs not in the first-party catalog', () => {
    expect(installSpecFor({ slug: 'unknown-pack', repository: null })).toBe('unknown-pack');
  });
});

describe('mergeFallbackCatalog', () => {
  it('keeps vim when the live registry omitted it', () => {
    const merged = mergeFallbackCatalog([
      {
        slug: 'stamp',
        name: 'Stamp',
        description: '',
        version: '0.1.0',
        author: 'Dripnex',
        repository: 'dripnex/plugin-stamp',
      },
    ]);
    expect(merged.map(p => p.slug)).toContain('dripnex-vim-mode');
    expect(merged.find(p => p.slug === 'dripnex-vim-mode')?.repository).toBe('dripnex/plugin-vim');
  });

  it('does not duplicate a pack the registry already listed', () => {
    const merged = mergeFallbackCatalog([
      {
        slug: 'dripnex-vim-mode',
        name: 'Vim Mode',
        description: '',
        version: '1.2.0',
        author: 'Dripnex',
        repository: 'dripnex/plugin-vim',
      },
    ]);
    expect(merged.filter(p => p.slug === 'dripnex-vim-mode')).toHaveLength(1);
  });

  it('live dripnex-vim-mode row with no repositoryUrl still installs via dripnex/plugin-vim', () => {
    const merged = mergeFallbackCatalog([
      {
        slug: 'dripnex-vim-mode',
        name: 'Vim Mode',
        description: '',
        version: '1.2.0',
        author: 'Dripnex',
        repository: null,
      },
    ]);
    const vim = merged.find(p => p.slug === 'dripnex-vim-mode');
    expect(merged.filter(p => p.slug === 'dripnex-vim-mode')).toHaveLength(1);
    expect(vim?.repository).toBe('dripnex/plugin-vim');
    expect(installSpecFor(vim!)).toBe('dripnex/plugin-vim');
  });

  it('keeps mermaid and math when the live registry omitted them', () => {
    const merged = mergeFallbackCatalog([
      {
        slug: 'stamp',
        name: 'Stamp',
        description: '',
        version: '0.1.0',
        author: 'Dripnex',
        repository: 'dripnex/plugin-stamp',
      },
    ]);
    expect(merged.map(p => p.slug)).toEqual(
      expect.arrayContaining(['dripnex-vim-mode', 'mermaid', 'math'])
    );
  });

  it('keeps packed satellite themes when the live registry omitted them', () => {
    const packed = [
      'theme-parchment',
      'theme-harbor-dusk',
      'theme-wave',
      'theme-night',
      'theme-solarized-dark',
      'theme-solarized-light',
      'theme-gruvbox',
      'theme-glass',
      'theme-midnight',
      'theme-ember',
      'theme-ion',
      'theme-matcha',
      'theme-phosphor',
      'theme-fog',
    ];
    for (const id of packed) {
      const row = COMMUNITY_CATALOG.find(p => p.id === id);
      expect(row?.repository).toBe(`dripnex/${id}`);
    }
    const merged = mergeFallbackCatalog([
      {
        slug: 'stamp',
        name: 'Stamp',
        description: '',
        version: '0.1.0',
        author: 'Dripnex',
        repository: 'dripnex/plugin-stamp',
      },
    ]);
    expect(merged.find(p => p.slug === 'theme-harbor-dusk')?.repository).toBe(
      'dripnex/theme-harbor-dusk'
    );
    expect(installSpecFor(merged.find(p => p.slug === 'theme-harbor-dusk')!)).toBe(
      'dripnex/theme-harbor-dusk'
    );
  });
});

describe('matchRemoteForInstalled', () => {
  it('matches vim by scan id when the registry slug is the same', () => {
    const remote = matchRemoteForInstalled('dripnex-vim-mode', [
      {
        slug: 'dripnex-vim-mode',
        version: '1.3.0',
        repositoryUrl: 'https://github.com/dripnex/plugin-vim',
      },
    ]);
    expect(remote?.version).toBe('1.3.0');
    expect(
      installSpecFor({ slug: remote!.slug, repository: githubRepoFromUrl(remote!.repositoryUrl) })
    ).toBe('dripnex/plugin-vim');
  });

  it('matches vim by repository when the registry slug diverges', () => {
    const remote = matchRemoteForInstalled('dripnex-vim-mode', [
      {
        slug: 'vim',
        version: '1.3.0',
        repositoryUrl: 'https://github.com/dripnex/plugin-vim',
      },
    ]);
    expect(remote?.slug).toBe('vim');
    expect(remote?.version).toBe('1.3.0');
    expect(
      installSpecFor({
        slug: remote!.slug,
        repository: remote!.repository ?? githubRepoFromUrl(remote!.repositoryUrl),
      })
    ).toBe('dripnex/plugin-vim');
  });

  it('falls back to the first-party catalog when the registry omitted vim', () => {
    const remote = matchRemoteForInstalled('dripnex-vim-mode', [
      { slug: 'stamp', version: '0.1.0', repositoryUrl: 'https://github.com/dripnex/plugin-stamp' },
    ]);
    expect(remote?.slug).toBe('dripnex-vim-mode');
    expect(remote?.repository).toBe('dripnex/plugin-vim');
    expect(installSpecFor({ slug: remote!.slug, repository: remote!.repository ?? null })).toBe(
      'dripnex/plugin-vim'
    );
  });
});
