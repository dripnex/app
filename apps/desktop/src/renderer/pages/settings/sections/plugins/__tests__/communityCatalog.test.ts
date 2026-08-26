import { describe, expect, it } from 'vitest';
import {
  COMMUNITY_CATALOG,
  availableThemePalettes,
  cardsFromRegistry,
  githubRepoFromUrl,
  installSpecFor,
  installTargetFor,
  installedThemePluginIds,
  matchRemoteForInstalled,
  mergeFallbackCatalog,
  themeInstallBundleUrl,
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
      'theme-dune',
      'theme-noir',
      'theme-sakura',
      'theme-limestone',
      'theme-walnut',
      'theme-ash',
      'theme-quartz',
      'theme-cove',
      'theme-velvet',
      'theme-ink',
      'theme-pine',
      'theme-saffron',
    ];
    for (const id of packed) {
      const row = COMMUNITY_CATALOG.find(p => p.id === id);
      expect(row?.repository).toBe(`dripnex/${id}`);
      expect(row?.category).toBe('theme');
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
    expect(merged.map(p => p.slug)).toEqual(
      expect.arrayContaining(['theme-limestone', 'theme-walnut', 'theme-ash', 'theme-dune'])
    );
  });

  it('keeps live extras such as limestone when GET /plugins returns 30', () => {
    const live = COMMUNITY_CATALOG.map(p => ({
      slug: p.id,
      name: p.name,
      description: p.description,
      version: p.version,
      author: p.author,
      category: p.category,
      repositoryUrl: `https://github.com/${p.repository}`,
      bundleUrl: p.bundleUrl,
    }));
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

  it('does not install a mismatched bundleUrl for a non-pack GitHub identity', () => {
    const target = installTargetFor({
      slug: 'notes',
      name: 'Notes',
      description: '',
      version: '9.9.9',
      author: 'attacker',
      repository: 'dripnex/app',
      bundleUrl: 'https://github.com/attacker/notes/releases/download/v9.9.9/notes-9.9.9.tar.gz',
    });
    expect(target).toBe('dripnex/app');
    expect(target).not.toContain('attacker');
  });

  it('does not install a mismatched bundleUrl for a community GitHub identity', () => {
    const target = installTargetFor({
      slug: 'hello-notes',
      name: 'Hello Notes',
      description: '',
      version: '1.0.0',
      author: 'acme',
      repository: 'acme/hello-notes',
      bundleUrl: 'https://github.com/evil/x/releases/download/v9.9.9/x-9.9.9.tar.gz',
    });
    expect(target).toBe('acme/hello-notes');
    expect(target).not.toContain('evil');
  });

  it('still follows a community bundleUrl that belongs to the displayed repo', () => {
    const bundle =
      'https://github.com/acme/hello-notes/releases/download/v1.0.0/hello-notes-1.0.0.tar.gz';
    expect(
      installTargetFor({
        slug: 'hello-notes',
        name: 'Hello Notes',
        description: '',
        version: '1.0.0',
        author: 'acme',
        repository: 'acme/hello-notes',
        bundleUrl: bundle,
      })
    ).toBe(bundle);
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

describe('availableThemePalettes / themeInstallBundleUrl', () => {
  const fallback = mergeFallbackCatalog([], COMMUNITY_CATALOG);

  it('lists only uninstalled theme-category rows', () => {
    const available = availableThemePalettes(fallback, ['theme-limestone']);
    expect(available.some(p => p.slug === 'theme-limestone')).toBe(false);
    expect(available.some(p => p.slug === 'stamp')).toBe(false);
    expect(available.some(p => p.slug === 'dripnex-vim-mode')).toBe(false);
    expect(available.map(p => p.slug)).toEqual(
      expect.arrayContaining(['theme-dune', 'theme-sakura', 'theme-walnut', 'theme-ash'])
    );
    expect(available.every(p => p.category === 'theme')).toBe(true);
  });

  it('installs from the GitHub release tarball, not owner/repo', () => {
    const limestone = fallback.find(p => p.slug === 'theme-limestone');
    expect(limestone).toBeDefined();
    const url = themeInstallBundleUrl(limestone!);
    expect(url).toBe(
      'https://github.com/dripnex/theme-limestone/releases/download/v0.1.0/theme-limestone-0.1.0.tar.gz'
    );
    expect(url).toMatch(/^https:\/\/github\.com\/dripnex\/theme-limestone\/releases\/download\//);
    expect(url).not.toContain('api.github.com');
    expect(url).not.toContain('/git/contents');
  });

  it('keeps extras past Fog in the offline fallback', () => {
    const slugs = COMMUNITY_CATALOG.filter(p => p.category === 'theme').map(p => p.id);
    const fog = slugs.indexOf('theme-fog');
    expect(fog).toBeGreaterThanOrEqual(0);
    expect(slugs.slice(fog + 1)).toEqual(
      expect.arrayContaining([
        'theme-sakura',
        'theme-limestone',
        'theme-walnut',
        'theme-ash',
        'theme-quartz',
        'theme-cove',
        'theme-velvet',
        'theme-ink',
        'theme-pine',
        'theme-saffron',
        'theme-dune',
        'theme-noir',
      ])
    );
  });

  it('moves a JS-registered pack out of Available into In use', () => {
    const installed = installedThemePluginIds(['theme-dune'], [{ pluginId: 'theme-dune' }]);
    const available = availableThemePalettes(fallback, installed);
    expect(installed.has('theme-dune')).toBe(true);
    expect(available.some(p => p.slug === 'theme-dune')).toBe(false);
  });
});
