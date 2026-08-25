/**
 * Official Dripnex extras: GitHub org `dripnex`, repos `theme-*` / `plugin-*`.
 * Community POST /plugins must not claim these slugs, and Install must not
 * follow a registry `bundleUrl` that is not a dripnex GitHub release tarball.
 */

const FIRST_PARTY_PLUGIN_SLUGS = new Set(['stamp', 'mermaid', 'math', 'dripnex-vim-mode']);
const FIRST_PARTY_PACK_SLUG_RE = /^(theme|plugin)-[a-z0-9]+(-[a-z0-9]+)*$/;
const TRUSTED_FIRST_PARTY_BUNDLE_PATH = /^\/dripnex\/(?:theme|plugin)-[^/]+\/releases\/download\//;

export function isReservedFirstPartySlug(slug: string): boolean {
  return FIRST_PARTY_PLUGIN_SLUGS.has(slug) || FIRST_PARTY_PACK_SLUG_RE.test(slug);
}

export function isDripnexPackRepository(ownerRepo: string): boolean {
  const [owner, repo] = ownerRepo.split('/');
  return (
    owner?.toLowerCase() === 'dripnex' &&
    typeof repo === 'string' &&
    (repo.startsWith('theme-') || repo.startsWith('plugin-'))
  );
}

/** HTTPS GitHub release tarball under dripnex/theme-* or dripnex/plugin-*. */
export function isTrustedFirstPartyBundleUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.hostname !== 'github.com') return false;
    if (parsed.username || parsed.password) return false;
    return TRUSTED_FIRST_PARTY_BUNDLE_PATH.test(parsed.pathname);
  } catch {
    return false;
  }
}
