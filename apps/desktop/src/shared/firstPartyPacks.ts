/**
 * Official Dripnex extras: GitHub org `dripnex`, repos `theme-*` / `plugin-*`.
 * Community POST /plugins must not claim these slugs or impersonate those
 * repos. Install must not follow a registry `bundleUrl` that is not a
 * dripnex GitHub release tarball for an official-looking card.
 */

const FIRST_PARTY_PLUGIN_SLUGS = new Set(['stamp', 'mermaid', 'math', 'dripnex-vim-mode']);
const FIRST_PARTY_PACK_SLUG_RE = /^(theme|plugin)-[a-z0-9]+(-[a-z0-9]+)*$/;
const TRUSTED_FIRST_PARTY_BUNDLE_PATH = /^\/dripnex\/(?:theme|plugin)-[^/]+\/releases\/download\//;

export function isReservedFirstPartySlug(slug: string): boolean {
  return FIRST_PARTY_PLUGIN_SLUGS.has(slug) || FIRST_PARTY_PACK_SLUG_RE.test(slug);
}

export function isDripnexPackRepository(ownerRepo: string): boolean {
  const [owner, repo] = ownerRepo.split('/');
  if (owner?.toLowerCase() !== 'dripnex' || typeof repo !== 'string') return false;
  const name = repo.toLowerCase();
  return name.startsWith('theme-') || name.startsWith('plugin-');
}

/** `owner/repo` from an https://github.com/... URL. Hostname must be github.com. */
export function githubRepoFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:') return null;
    if (parsed.hostname !== 'github.com') return null;
    if (parsed.username || parsed.password) return null;
    const [owner, repo] = parsed.pathname
      .replace(/^\//, '')
      .replace(/\.git$/i, '')
      .replace(/\/+$/, '')
      .split('/');
    return owner && repo ? `${owner}/${repo}` : null;
  } catch {
    return null;
  }
}

export function isDripnexPackRepositoryUrl(url: string | null | undefined): boolean {
  const repo = githubRepoFromUrl(url);
  return repo != null && isDripnexPackRepository(repo);
}

/** Slug reserved, or the visible GitHub repo is a dripnex theme/plugin satellite. */
export function isOfficialLookingCatalogCard(
  slug: string,
  repository: string | null | undefined
): boolean {
  return (
    isReservedFirstPartySlug(slug) ||
    (typeof repository === 'string' && isDripnexPackRepository(repository))
  );
}

/** HTTPS GitHub release tarball under dripnex/theme-* or dripnex/plugin-*. */
export function isTrustedFirstPartyBundleUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.hostname !== 'github.com') return false;
    if (parsed.username || parsed.password) return false;
    return TRUSTED_FIRST_PARTY_BUNDLE_PATH.test(parsed.pathname.toLowerCase());
  } catch {
    return false;
  }
}
