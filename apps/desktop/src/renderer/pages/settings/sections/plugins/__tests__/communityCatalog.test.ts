import { describe, expect, it } from 'vitest';
import {
  COMMUNITY_CATALOG,
  cardsFromRegistry,
  githubRepoFromUrl,
  installSpecFor,
  installTargetFor,
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

  it('keeps live extras such as limestone when GET /plugins returns 30', () => {
    const live = [
      ...COMMUNITY_CATALOG.map(p => ({
        slug: p.id,
        name: p.name,
        description: p.description,
        version: p.version,
        author: p.author,
        repositoryUrl: `https://github.com/${p.repository}`,
        bundleUrl: `https://github.com/${p.repository}/releases/download/v0.1.0/${p.id}-0.1.0.tar.gz`,
      })),
      {
        slug: 'theme-dune',
        name: 'Dune',
        description: 'Desert afternoon.',
        version: '0.1.0',
        author: 'Dripnex',
        repositoryUrl: 'https://github.com/dripnex/theme-dune',
        bundleUrl:
          'https://github.com/dripnex/theme-dune/releases/download/v0.1.0/theme-dune-0.1.0.tar.gz',
      },
      {
        slug: 'theme-noir',
        name: 'Noir',
        description: 'Cinema black.',
        version: '0.1.0',
        author: 'Dripnex',
        repositoryUrl: 'https://github.com/dripnex/theme-noir',
        bundleUrl:
          'https://github.com/dripnex/theme-noir/releases/download/v0.1.0/theme-noir-0.1.0.tar.gz',
      },
      {
        slug: 'theme-sakura',
        name: 'Sakura',
        description: 'Cherry-blossom paper.',
        version: '0.1.0',
        author: 'Dripnex',
        repositoryUrl: 'https://github.com/dripnex/theme-sakura',
        bundleUrl:
          'https://github.com/dripnex/theme-sakura/releases/download/v0.1.0/theme-sakura-0.1.0.tar.gz',
      },
      {
        slug: 'theme-limestone',
        name: 'Limestone',
        description: 'Warm stone.',
        version: '0.1.0',
        author: 'Dripnex',
        repositoryUrl: 'https://github.com/dripnex/theme-limestone',
        bundleUrl:
          'https://github.com/dripnex/theme-limestone/releases/download/v0.1.0/theme-limestone-0.1.0.tar.gz',
      },
      {
        slug: 'theme-walnut',
        name: 'Walnut',
        description: 'Dark wood.',
        version: '0.1.0',
        author: 'Dripnex',
        repositoryUrl: 'https://github.com/dripnex/theme-walnut',
        bundleUrl:
          'https://github.com/dripnex/theme-walnut/releases/download/v0.1.0/theme-walnut-0.1.0.tar.gz',
      },
      {
        slug: 'theme-ash',
        name: 'Ash',
        description: 'Pale timber.',
        version: '0.1.0',
        author: 'Dripnex',
        repositoryUrl: 'https://github.com/dripnex/theme-ash',
        bundleUrl:
          'https://github.com/dripnex/theme-ash/releases/download/v0.1.0/theme-ash-0.1.0.tar.gz',
      },
      {
        slug: 'theme-quartz',
        name: 'Quartz',
        description: '',
        version: '0.1.0',
        author: 'Dripnex',
        repositoryUrl: 'https://github.com/dripnex/theme-quartz',
        bundleUrl:
          'https://github.com/dripnex/theme-quartz/releases/download/v0.1.0/theme-quartz-0.1.0.tar.gz',
      },
      {
        slug: 'theme-cove',
        name: 'Cove',
        description: '',
        version: '0.1.0',
        author: 'Dripnex',
        repositoryUrl: 'https://github.com/dripnex/theme-cove',
        bundleUrl:
          'https://github.com/dripnex/theme-cove/releases/download/v0.1.0/theme-cove-0.1.0.tar.gz',
      },
      {
        slug: 'theme-velvet',
        name: 'Velvet',
        description: '',
        version: '0.1.0',
        author: 'Dripnex',
        repositoryUrl: 'https://github.com/dripnex/theme-velvet',
        bundleUrl:
          'https://github.com/dripnex/theme-velvet/releases/download/v0.1.0/theme-velvet-0.1.0.tar.gz',
      },
      {
        slug: 'theme-ink',
        name: 'Ink',
        description: '',
        version: '0.1.0',
        author: 'Dripnex',
        repositoryUrl: 'https://github.com/dripnex/theme-ink',
        bundleUrl:
          'https://github.com/dripnex/theme-ink/releases/download/v0.1.0/theme-ink-0.1.0.tar.gz',
      },
      {
        slug: 'theme-pine',
        name: 'Pine',
        description: '',
        version: '0.1.0',
        author: 'Dripnex',
        repositoryUrl: 'https://github.com/dripnex/theme-pine',
        bundleUrl:
          'https://github.com/dripnex/theme-pine/releases/download/v0.1.0/theme-pine-0.1.0.tar.gz',
      },
      {
        slug: 'theme-saffron',
        name: 'Saffron',
        description: '',
        version: '0.1.0',
        author: 'Dripnex',
        repositoryUrl: 'https://github.com/dripnex/theme-saffron',
        bundleUrl:
          'https://github.com/dripnex/theme-saffron/releases/download/v0.1.0/theme-saffron-0.1.0.tar.gz',
      },
    ];
    expect(live).toHaveLength(30);
    const catalog = mergeFallbackCatalog(cardsFromRegistry(live));
    const slugs = catalog.map(p => p.slug);
    expect(slugs).toContain('theme-limestone');
    expect(slugs).toContain('theme-walnut');
    expect(slugs).toContain('theme-ash');
    expect(catalog).toHaveLength(30);
    const limestone = catalog.find(p => p.slug === 'theme-limestone');
    expect(limestone?.repository).toBe('dripnex/theme-limestone');
    expect(installTargetFor(limestone!)).toContain('theme-limestone-0.1.0.tar.gz');
    expect(installTargetFor(limestone!)).toMatch(/^https:\/\//);
  });

  it('drops a squatted first-party card whose bundle is not a dripnex release', () => {
    const catalog = cardsFromRegistry([
      {
        slug: 'theme-limestone',
        name: 'Limestone (hijack)',
        description: '',
        version: '9.9.9',
        author: 'attacker',
        repositoryUrl: 'https://github.com/attacker/theme-limestone',
        bundleUrl:
          'https://github.com/attacker/theme-limestone/releases/download/v9.9.9/theme-limestone-9.9.9.tar.gz',
      },
      {
        slug: 'hello-notes',
        name: 'Hello Notes',
        description: '',
        version: '1.0.0',
        author: 'acme',
        repositoryUrl: 'https://github.com/acme/hello-notes',
        bundleUrl:
          'https://github.com/acme/hello-notes/releases/download/v1.0.0/hello-notes-1.0.0.tar.gz',
      },
    ]);
    expect(catalog.map(p => p.slug)).toEqual(['hello-notes']);
  });

  it('does not install a first-party card from an attacker bundleUrl', () => {
    const target = installTargetFor({
      slug: 'theme-limestone',
      name: 'Limestone',
      description: '',
      version: '0.1.0',
      author: 'Dripnex',
      repository: 'dripnex/theme-limestone',
      bundleUrl:
        'https://github.com/attacker/theme-limestone/releases/download/v9.9.9/theme-limestone-9.9.9.tar.gz',
    });
    expect(target).toBe('dripnex/theme-limestone');
    expect(target).not.toContain('attacker');
  });

  it('drops a community card that displays a dripnex pack repo', () => {
    const catalog = cardsFromRegistry([
      {
        slug: 'limestone',
        name: 'Limestone',
        description: '',
        version: '9.9.9',
        author: 'attacker',
        repositoryUrl: 'https://github.com/dripnex/theme-limestone',
        bundleUrl:
          'https://github.com/attacker/limestone/releases/download/v9.9.9/limestone-9.9.9.tar.gz',
      },
      {
        slug: 'limestone-case',
        name: 'Limestone',
        description: '',
        version: '9.9.9',
        author: 'attacker',
        repositoryUrl: 'https://github.com/dripnex/Theme-limestone',
        bundleUrl:
          'https://github.com/attacker/limestone/releases/download/v9.9.9/limestone-9.9.9.tar.gz',
      },
      {
        slug: 'hello-notes',
        name: 'Hello Notes',
        description: '',
        version: '1.0.0',
        author: 'acme',
        repositoryUrl: 'https://github.com/acme/hello-notes',
        bundleUrl:
          'https://github.com/acme/hello-notes/releases/download/v1.0.0/hello-notes-1.0.0.tar.gz',
      },
    ]);
    expect(catalog.map(p => p.slug)).toEqual(['hello-notes']);
  });

  it('does not install from an attacker bundle when the card shows a dripnex repo', () => {
    const target = installTargetFor({
      slug: 'limestone',
      name: 'Limestone',
      description: '',
      version: '9.9.9',
      author: 'attacker',
      repository: 'dripnex/theme-limestone',
      bundleUrl:
        'https://github.com/attacker/limestone/releases/download/v9.9.9/limestone-9.9.9.tar.gz',
    });
    expect(target).toBe('dripnex/theme-limestone');
    expect(target).not.toContain('attacker');

    const mixed = installTargetFor({
      slug: 'limestone-case',
      name: 'Limestone',
      description: '',
      version: '9.9.9',
      author: 'attacker',
      repository: 'dripnex/Theme-limestone',
      bundleUrl:
        'https://github.com/attacker/limestone/releases/download/v9.9.9/limestone-9.9.9.tar.gz',
    });
    expect(mixed).toBe('dripnex/Theme-limestone');
    expect(mixed).not.toContain('attacker');
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
