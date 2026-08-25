/**
 * First-party community plugins. Same shape as Inkdrop: one git repo per
 * plugin, installed from its GitHub release tarball. Not a fake marketplace —
 * only list plugins that actually exist as public repos WITH a GitHub Release
 * tarball (`{id}-{version}.tar.gz`). A git tag alone is not enough.
 *
 * Live Browse comes from GET /plugins on the Worker (dripnex theme-* /
 * plugin-* repos with a packed Release tarball). This array is the offline
 * fallback when that API is unreachable — do not generate it from GitHub
 * in the renderer.
 *
 * Three strings are not interchangeable (#562):
 *   id          — manifest.json / scan().id (folder name after install)
 *   repository  — GitHub owner/repo. This is the working install spec.
 *   registry slug — GET /plugins/:slug. Missing for vim on the live API.
 * Install must send `repository` (`dripnex/plugin-vim`), not `id`.
 */

import {
  githubRepoFromUrl,
  isDripnexPackRepository,
  isOfficialLookingCatalogCard,
  isReservedFirstPartySlug,
  isTrustedFirstPartyBundleUrl,
} from '../../../../../shared/firstPartyPacks';

export { githubRepoFromUrl };

export interface CatalogPlugin {
  /** manifest.json id — what scan() returns after install */
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  /** GitHub owner/repo. Pass this to installFromSpec. */
  repository: string;
}

export const COMMUNITY_CATALOG: CatalogPlugin[] = [
  {
    id: 'dripnex-vim-mode',
    name: 'Vim Mode',
    description: 'Vim keybindings, Ex commands, relative line numbers, and clipboard yank.',
    version: '1.2.0',
    author: 'Dripnex',
    repository: 'dripnex/plugin-vim',
  },
  {
    id: 'mermaid',
    name: 'Mermaid',
    description: 'Insert a mermaid fence at the cursor. Preview rendering ships with Dripnex.',
    version: '0.1.0',
    author: 'Dripnex',
    repository: 'dripnex/plugin-mermaid',
  },
  {
    id: 'math',
    name: 'Math',
    description: 'Insert a LaTeX math fence at the cursor. KaTeX rendering ships with Dripnex.',
    version: '0.1.0',
    author: 'Dripnex',
    repository: 'dripnex/plugin-math',
  },
  {
    id: 'stamp',
    name: 'Stamp',
    description: 'Insert the current date or timestamp at the cursor.',
    version: '0.1.0',
    author: 'Dripnex',
    repository: 'dripnex/plugin-stamp',
  },
  {
    id: 'theme-parchment',
    name: 'Parchment',
    description: 'Warm paper palette. Official Dripnex theme.',
    version: '0.1.0',
    author: 'Dripnex',
    repository: 'dripnex/theme-parchment',
  },
  {
    id: 'theme-harbor-dusk',
    name: 'Harbor Dusk',
    description: 'Coastal evening palette for long writing sessions.',
    version: '0.1.0',
    author: 'Dripnex',
    repository: 'dripnex/theme-harbor-dusk',
  },
  {
    id: 'theme-wave',
    name: 'Wave',
    description: 'Ink and paper, after dark.',
    version: '0.1.0',
    author: 'Dripnex',
    repository: 'dripnex/theme-wave',
  },
  {
    id: 'theme-night',
    name: 'Night',
    description: 'Violet dusk. Focused writing after hours.',
    version: '0.1.0',
    author: 'Dripnex',
    repository: 'dripnex/theme-night',
  },
  {
    id: 'theme-solarized-dark',
    name: 'Solarized Dark',
    description: 'Ethan Schoonover. The Vim classic.',
    version: '0.1.0',
    author: 'Dripnex',
    repository: 'dripnex/theme-solarized-dark',
  },
  {
    id: 'theme-solarized-light',
    name: 'Solarized Light',
    description: 'Cream paper, cyan marks. Same palette, daylight.',
    version: '0.1.0',
    author: 'Dripnex',
    repository: 'dripnex/theme-solarized-light',
  },
  {
    id: 'theme-gruvbox',
    name: 'Gruvbox',
    description: 'Retro groove. The other Vim default.',
    version: '0.1.0',
    author: 'Dripnex',
    repository: 'dripnex/theme-gruvbox',
  },
  {
    id: 'theme-glass',
    name: 'Glass',
    description: 'Ice. The desktop shows through.',
    version: '0.1.0',
    author: 'Dripnex',
    repository: 'dripnex/theme-glass',
  },
  {
    id: 'theme-midnight',
    name: 'Midnight',
    description: 'OLED navy, electric blue. Frosted.',
    version: '0.1.0',
    author: 'Dripnex',
    repository: 'dripnex/theme-midnight',
  },
  {
    id: 'theme-ember',
    name: 'Ember',
    description: 'Warm black, copper light. Frosted.',
    version: '0.1.0',
    author: 'Dripnex',
    repository: 'dripnex/theme-ember',
  },
  {
    id: 'theme-ion',
    name: 'Ion',
    description: 'Violet glass. Linear-adjacent, frosted.',
    version: '0.1.0',
    author: 'Dripnex',
    repository: 'dripnex/theme-ion',
  },
  {
    id: 'theme-matcha',
    name: 'Matcha',
    description: 'Green-tea paper. Calm reading.',
    version: '0.1.0',
    author: 'Dripnex',
    repository: 'dripnex/theme-matcha',
  },
  {
    id: 'theme-phosphor',
    name: 'Phosphor',
    description: 'Amber CRT. Terminal glow after midnight.',
    version: '0.1.0',
    author: 'Dripnex',
    repository: 'dripnex/theme-phosphor',
  },
  {
    id: 'theme-fog',
    name: 'Fog',
    description: 'Coastal gray morning. Muted blue marks.',
    version: '0.1.0',
    author: 'Dripnex',
    repository: 'dripnex/theme-fog',
  },
];

export interface CatalogCard {
  slug: string;
  name: string;
  description: string;
  version: string;
  author: string;
  repository: string | null;
  bundleUrl?: string | null;
}

/**
 * owner/repo when we have it — that is the spec that resolves a GitHub tarball.
 * If the live card omitted repository, use the first-party catalog repo for
 * that slug so vim never installs as `dripnex-vim-mode` (#562).
 */
export function installSpecFor(
  card: { slug: string; repository: string | null },
  fallback: CatalogPlugin[] = COMMUNITY_CATALOG
): string {
  if (card.repository) return card.repository;
  return fallback.find(p => p.id === card.slug)?.repository ?? card.slug;
}

/**
 * Live GET /plugins rows become Browse cards. No slug allowlist — extras
 * such as theme-limestone must appear when the Worker returns them.
 */
export function cardsFromRegistry(
  plugins: Array<{
    slug: string;
    name: string;
    description: string;
    version: string;
    author: string;
    repositoryUrl?: string | null;
    bundleUrl?: string | null;
  }>
): CatalogCard[] {
  return plugins.flatMap(p => {
    const repository = githubRepoFromUrl(p.repositoryUrl);
    if (repository && isDripnexPackRepository(repository) && !isReservedFirstPartySlug(p.slug)) {
      return [];
    }
    if (isReservedFirstPartySlug(p.slug)) {
      if (p.bundleUrl && !isTrustedFirstPartyBundleUrl(p.bundleUrl)) return [];
      if (repository && !isDripnexPackRepository(repository)) return [];
    }
    return [
      {
        slug: p.slug,
        name: p.name,
        description: p.description,
        version: p.version,
        author: p.author,
        repository,
        bundleUrl: p.bundleUrl ?? null,
      },
    ];
  });
}

/**
 * Keep first-party fallback cards that the live registry omitted, and fill
 * `repository` on a live row that listed the slug without repositoryUrl.
 * Browse used to replace the fallback entirely, which hid Vim (#562).
 * Live extras not in COMMUNITY_CATALOG are kept as-is.
 */
export function mergeFallbackCatalog(
  registry: CatalogCard[],
  fallback: CatalogPlugin[] = COMMUNITY_CATALOG
): CatalogCard[] {
  const byId = new Map(fallback.map(p => [p.id, p]));
  const filled = registry.map(card => {
    if (card.repository) return card;
    const known = byId.get(card.slug);
    return known ? { ...card, repository: known.repository } : card;
  });
  const slugs = new Set(filled.map(p => p.slug));
  const extra = fallback
    .filter(p => !slugs.has(p.id))
    .map(p => ({
      slug: p.id,
      name: p.name,
      description: p.description,
      version: p.version,
      author: p.author,
      repository: p.repository,
      bundleUrl: null as string | null,
    }));
  return extra.length === 0 ? filled : [...extra, ...filled];
}

/**
 * Prefer the Worker catalog tarball so Install does not call api.github.com.
 * Official-looking cards (reserved slug or dripnex theme/plugin repo) only
 * follow a dripnex GitHub release URL — a community row must not display
 * dripnex/theme-* while Install follows an attacker bundleUrl.
 */
export function installTargetFor(card: CatalogCard): string {
  if (card.bundleUrl?.startsWith('https://')) {
    if (
      !isOfficialLookingCatalogCard(card.slug, card.repository) ||
      isTrustedFirstPartyBundleUrl(card.bundleUrl)
    ) {
      return card.bundleUrl;
    }
  }
  return installSpecFor(card);
}

export interface RemoteCatalogRow {
  slug: string;
  version: string;
  name?: string;
  repository?: string | null;
  repositoryUrl?: string | null;
}

/**
 * Match an installed pack to a registry (or fallback) row by id/slug **or**
 * GitHub repository. Vim's scan().id is dripnex-vim-mode; a live row might
 * only share dripnex/plugin-vim (#547 / #562).
 */
export function matchRemoteForInstalled(
  installedId: string,
  registry: RemoteCatalogRow[],
  fallback: CatalogPlugin[] = COMMUNITY_CATALOG
): RemoteCatalogRow | null {
  const known = fallback.find(p => p.id === installedId);
  const bySlug = registry.find(p => p.slug === installedId);
  if (bySlug) return bySlug;

  const repo = known?.repository;
  if (repo) {
    const byRepo = registry.find(p => {
      const remoteRepo = p.repository ?? githubRepoFromUrl(p.repositoryUrl);
      return remoteRepo === repo;
    });
    if (byRepo) return byRepo;
    return {
      slug: known.id,
      version: known.version,
      name: known.name,
      repository: known.repository,
    };
  }

  return null;
}
