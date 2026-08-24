/**
 * First-party community plugins. Same shape as Inkdrop: one git repo per
 * plugin, installed from its GitHub release tarball. Not a fake marketplace —
 * only list plugins that actually exist as public repos WITH a GitHub Release
 * tarball (`{id}-{version}.tar.gz`). A git tag alone is not enough.
 *
 * Three strings are not interchangeable (#562):
 *   id          — manifest.json / scan().id (folder name after install)
 *   repository  — GitHub owner/repo. This is the working install spec.
 *   registry slug — GET /plugins/:slug. Missing for vim on the live API.
 * Install must send `repository` (`dripnex/plugin-vim`), not `id`.
 */

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
];

export interface CatalogCard {
  slug: string;
  name: string;
  description: string;
  version: string;
  author: string;
  repository: string | null;
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
 * Keep first-party fallback cards that the live registry omitted, and fill
 * `repository` on a live row that listed the slug without repositoryUrl.
 * Browse used to replace the fallback entirely, which hid Vim (#562).
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
    }));
  return extra.length === 0 ? filled : [...extra, ...filled];
}

export function githubRepoFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const path = trimmed
    .replace(/^https:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
  const [owner, repo] = path.split('/');
  return owner && repo ? `${owner}/${repo}` : null;
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
