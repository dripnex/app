/**
 * First-party community plugins. Same shape as Inkdrop: one git repo per
 * plugin, installed from its GitHub release tarball. Not a fake marketplace —
 * only list plugins that actually exist as public repos with a release.
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
    id: 'stamp',
    name: 'Stamp',
    description: 'Insert the current date or timestamp at the cursor.',
    version: '0.1.0',
    author: 'Dripnex',
    repository: 'dripnex/plugin-stamp',
  },
  {
    id: 'dripnex-vim-mode',
    name: 'Vim Mode',
    description: 'Vim keybindings, Ex commands, relative line numbers, and clipboard yank.',
    version: '1.2.0',
    author: 'Dripnex',
    repository: 'dripnex/plugin-vim',
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
