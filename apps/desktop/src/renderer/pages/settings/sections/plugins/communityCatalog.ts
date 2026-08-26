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
  catalogBundleUrlForInstall,
  githubRepoFromUrl,
  isDripnexPackRepository,
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
  /** GET /plugins `category`. Themes filter on `"theme"`. */
  category: 'theme' | 'editor';
  /** GitHub Release tarball. Themes install this URL, never git/contents. */
  bundleUrl: string;
}

function editorPack(
  id: string,
  name: string,
  description: string,
  repository: string,
  version: string
): CatalogPlugin {
  const asset = `${id}-${version}.tar.gz`;
  return {
    id,
    name,
    description,
    version,
    author: 'Dripnex',
    repository,
    category: 'editor',
    bundleUrl: `https://github.com/${repository}/releases/download/v${version}/${asset}`,
  };
}

function themePack(
  id: string,
  name: string,
  description: string,
  version = '0.1.0'
): CatalogPlugin {
  const repository = `dripnex/${id}`;
  return {
    id,
    name,
    description,
    version,
    author: 'Dripnex',
    repository,
    category: 'theme',
    bundleUrl: `https://github.com/${repository}/releases/download/v${version}/${id}-${version}.tar.gz`,
  };
}

export const COMMUNITY_CATALOG: CatalogPlugin[] = [
  editorPack(
    'dripnex-vim-mode',
    'Vim Mode',
    'Vim keybindings, Ex commands, relative line numbers, and clipboard yank.',
    'dripnex/plugin-vim',
    '1.2.0'
  ),
  editorPack(
    'mermaid',
    'Mermaid',
    'Insert a mermaid fence at the cursor. Preview rendering ships with Dripnex.',
    'dripnex/plugin-mermaid',
    '0.1.0'
  ),
  editorPack(
    'math',
    'Math',
    'Insert a LaTeX math fence at the cursor. KaTeX rendering ships with Dripnex.',
    'dripnex/plugin-math',
    '0.1.0'
  ),
  editorPack(
    'stamp',
    'Stamp',
    'Insert the current date or timestamp at the cursor.',
    'dripnex/plugin-stamp',
    '0.1.0'
  ),
  themePack('theme-parchment', 'Parchment', 'Warm paper palette. Official Dripnex theme.'),
  themePack(
    'theme-harbor-dusk',
    'Harbor Dusk',
    'Coastal evening palette for long writing sessions.'
  ),
  themePack('theme-wave', 'Wave', 'Ink and paper, after dark.'),
  themePack('theme-night', 'Night', 'Violet dusk. Focused writing after hours.'),
  themePack('theme-solarized-dark', 'Solarized Dark', 'Ethan Schoonover. The Vim classic.'),
  themePack(
    'theme-solarized-light',
    'Solarized Light',
    'Cream paper, cyan marks. Same palette, daylight.'
  ),
  themePack('theme-gruvbox', 'Gruvbox', 'Retro groove. The other Vim default.'),
  themePack('theme-glass', 'Glass', 'Ice. The desktop shows through.'),
  themePack('theme-midnight', 'Midnight', 'OLED navy, electric blue. Frosted.'),
  themePack('theme-ember', 'Ember', 'Warm black, copper light. Frosted.'),
  themePack('theme-ion', 'Ion', 'Violet glass. Linear-adjacent, frosted.'),
  themePack('theme-matcha', 'Matcha', 'Green-tea paper. Calm reading.'),
  themePack('theme-phosphor', 'Phosphor', 'Amber CRT. Terminal glow after midnight.'),
  themePack('theme-fog', 'Fog', 'Coastal gray morning. Muted blue marks.'),
  themePack('theme-dune', 'Dune', 'Desert afternoon. Sand paper, terracotta marks.'),
  themePack('theme-noir', 'Noir', 'Cinema black. Cool silver, a single crimson mark.'),
  themePack('theme-sakura', 'Sakura', 'Cherry-blossom paper. Pale rose, quiet ink.'),
  themePack(
    'theme-limestone',
    'Limestone',
    'Warm-neutral stone. Editorial paper, not yellow cream.'
  ),
  themePack('theme-walnut', 'Walnut', 'Dark walnut. Cream on wood.'),
  themePack('theme-ash', 'Ash', 'Zinc SaaS. Desaturated dashboard dark.'),
  themePack('theme-quartz', 'Quartz', 'Cold paper. Clean product light.'),
  themePack('theme-cove', 'Cove', 'Dusk over a cove. Green-black water, clear teal.'),
  themePack('theme-velvet', 'Velvet', 'Wine-dark. Dusty rose, not neon violet.'),
  themePack('theme-ink', 'Ink', 'True black. Fountain-pen white on ink.'),
  themePack('theme-pine', 'Pine', 'Forest dusk. Deep pine, moss marks.'),
  themePack('theme-saffron', 'Saffron', 'Saffron afternoon. Gold paper, turmeric marks.'),
];

export interface CatalogCard {
  slug: string;
  name: string;
  description: string;
  version: string;
  author: string;
  repository: string | null;
  bundleUrl?: string | null;
  category?: string | null;
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
    category?: string | null;
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
    const category =
      typeof p.category === 'string' && p.category.trim()
        ? p.category
        : p.slug.startsWith('theme-')
          ? 'theme'
          : null;
    return [
      {
        slug: p.slug,
        name: p.name,
        description: p.description,
        version: p.version,
        author: p.author,
        repository,
        bundleUrl: p.bundleUrl ?? null,
        category,
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
    const known = byId.get(card.slug);
    if (!known) return card;
    return {
      ...card,
      repository: card.repository ?? known.repository,
      category: card.category ?? known.category,
      bundleUrl: card.bundleUrl ?? known.bundleUrl,
    };
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
      bundleUrl: p.bundleUrl,
      category: p.category,
    }));
  return extra.length === 0 ? filled : [...extra, ...filled];
}

/**
 * Prefer the Worker catalog tarball so Install does not call api.github.com,
 * but only when that URL belongs to the card's GitHub identity. Official pack
 * cards only follow a dripnex GitHub release tarball for that repo.
 */
export function installTargetFor(card: CatalogCard): string {
  return (
    catalogBundleUrlForInstall(card.slug, card.repository, card.bundleUrl) ?? installSpecFor(card)
  );
}

/** Settings → Themes: only GET /plugins rows with category "theme". */
export function isThemeCatalogCard(card: { category?: string | null; slug: string }): boolean {
  return card.category === 'theme';
}

/**
 * Available palettes = theme-category catalog rows that are not installed.
 * Installed ids are scan().id / pluginId (e.g. theme-limestone), not registerTheme ids.
 */
export function availableThemePalettes(
  catalog: CatalogCard[],
  installedIds: Iterable<string>
): CatalogCard[] {
  const installed = new Set(installedIds);
  return catalog.filter(card => isThemeCatalogCard(card) && !installed.has(card.slug));
}

export function installedThemePluginIds(
  scannedIds: Iterable<string>,
  registered: Array<{ pluginId?: string }>
): Set<string> {
  const ids = new Set(scannedIds);
  for (const theme of registered) {
    if (theme.pluginId) ids.add(theme.pluginId);
  }
  return ids;
}

/** Trusted GitHub release tarball, or null — never owner/repo (that hits api.github.com). */
export function themeInstallBundleUrl(card: CatalogCard): string | null {
  return catalogBundleUrlForInstall(card.slug, card.repository, card.bundleUrl);
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
