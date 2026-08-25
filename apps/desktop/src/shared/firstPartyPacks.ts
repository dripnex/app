/**
 * Official Dripnex extras: GitHub org `dripnex`, repos `theme-*` / `plugin-*`.
 * Community POST /plugins must not claim these slugs or impersonate those
 * repos. Install must not follow a registry `bundleUrl` that is not a
 * dripnex GitHub release tarball for an official-looking card.
 *
 * Keep slug / URL / bundle rules in sync with packages/api/src/routes/plugins.ts.
 * Desktop cannot import the Worker package; both sides share this contract via tests.
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

export function sameGithubRepo(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** `owner/repo` from an https://github.com/... URL. Hostname must be github.com. */
export function githubRepoFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:') return null;
    if (parsed.hostname !== 'github.com') return null;
    if (parsed.username || parsed.password) return null;
    const parts = parsed.pathname.replace(/^\//, '').replace(/\/+$/, '').split('/');
    const owner = parts[0];
    const repo = parts[1]?.replace(/\.git$/i, '');
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

/**
 * Live catalog `bundleUrl` only when it belongs to the card's GitHub identity.
 * Official pack cards (reserved slug, dripnex theme/plugin repo, or a dripnex
 * pack tarball) may only follow a trusted dripnex release URL for that repo.
 */
export function catalogBundleUrlForInstall(
  slug: string,
  repository: string | null | undefined,
  bundleUrl: string | null | undefined
): string | null {
  if (!bundleUrl?.startsWith('https://')) return null;
  const bundleRepo = githubRepoFromUrl(bundleUrl);
  const displayed = typeof repository === 'string' && repository.length > 0 ? repository : null;
  const official =
    isOfficialLookingCatalogCard(slug, displayed) ||
    (bundleRepo != null && isDripnexPackRepository(bundleRepo));

  if (official) {
    if (!isTrustedFirstPartyBundleUrl(bundleUrl)) return null;
    if (displayed && bundleRepo && !sameGithubRepo(displayed, bundleRepo)) return null;
    return bundleUrl;
  }

  if (displayed) {
    return bundleRepo && sameGithubRepo(displayed, bundleRepo) ? bundleUrl : null;
  }

  return bundleRepo ? bundleUrl : null;
}
