/**
 * First-party Browse discovery against the dripnex GitHub org.
 *
 * GitHub is the source of *which* packs exist: public `theme-*` / `plugin-*`
 * repos whose latest Release has a packed `.tar.gz` asset. The git tag
 * source tarball (`tarball_url`) is never listed. Repos such as `app`,
 * `marketing`, and `docs-site` are skipped by the name prefix.
 *
 * `FIRST_PARTY_PACKAGES` in the plugins route is the seed (used when GitHub
 * is down) and the override map (slug / name / description / icon / tags).
 *
 * Slug resolution, in order:
 *   1. Seed row whose repositoryUrl matches the GitHub repo
 *   2. `manifest.json` `id` on the default branch (raw.githubusercontent.com)
 *   3. `theme-*` → repository name; `plugin-vim` → `dripnex-vim-mode`;
 *      other `plugin-*` → name with the `plugin-` prefix stripped
 *
 * Optional `GITHUB_TOKEN` raises the GitHub REST rate limit. Unauthenticated
 * public requests still work. Successful lists are cached for ~12 minutes.
 */

const ORG = 'dripnex';
const API = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';
const USER_AGENT = 'dripnex-api';
const ACCEPT = 'application/vnd.github+json';
const API_VERSION = '2022-11-28';

/** Successful GitHub lists live this long in-process. */
export const GITHUB_PACKS_TTL_MS = 12 * 60 * 1000;
/** Failed lookups retry after a short pause so we do not hammer a 403. */
const GITHUB_PACKS_FAILURE_TTL_MS = 60 * 1000;
const REPOS_PER_PAGE = 100;
const MAX_PAGES = 5;

export type DiscoveredPack = {
  repoName: string;
  htmlUrl: string;
  description: string;
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
  version: string;
  bundleUrl: string;
  kind: 'theme' | 'plugin';
};

type GhRepo = {
  name?: string;
  html_url?: string;
  description?: string | null;
  default_branch?: string;
  created_at?: string;
  updated_at?: string;
  archived?: boolean;
  fork?: boolean;
  private?: boolean;
};

type GhRelease = {
  tag_name?: string;
  published_at?: string;
  tarball_url?: string;
  assets?: Array<{ name?: string; browser_download_url?: string }>;
};

type CacheEntry = { until: number; packs: DiscoveredPack[] | null };

let cache: CacheEntry | null = null;

export function resetGithubPacksCache(): void {
  cache = null;
}

export function isFirstPartyRepoName(name: string): boolean {
  return name.startsWith('theme-') || name.startsWith('plugin-');
}

export function packKind(repoName: string): 'theme' | 'plugin' {
  return repoName.startsWith('theme-') ? 'theme' : 'plugin';
}

/**
 * Documented slug fallback when the seed has no row and manifest.json is
 * missing. `plugin-vim` stays `dripnex-vim-mode` (#547 / #562).
 */
export function fallbackSlug(repoName: string): string {
  if (repoName === 'plugin-vim') return 'dripnex-vim-mode';
  if (repoName.startsWith('theme-')) return repoName;
  if (repoName.startsWith('plugin-')) return repoName.slice('plugin-'.length);
  return repoName;
}

export function humanizeRepoName(repoName: string): string {
  const trimmed = repoName.replace(/^(theme|plugin)-/, '');
  return trimmed
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function versionFromTag(tag: string): string {
  return tag.startsWith('v') && /^\d/.test(tag.slice(1)) ? tag.slice(1) : tag;
}

export function normalizeGithubRepoUrl(url: string): string {
  return url
    .trim()
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

/**
 * Packed `{id}-{version}.tar.gz` (parchment pattern), then any `.tar.gz` /
 * `.tgz` asset. Never the release `tarball_url` (git source tree).
 */
export function pickPackedTarball(
  assets: Array<{ name?: string; browser_download_url?: string }>,
  slugCandidates: string[],
  version: string
): string | null {
  const wanted = new Set(
    slugCandidates.flatMap(id => [`${id}-${version}.tar.gz`, `${id}-${version}.tgz`])
  );
  const exact = assets.find(a => typeof a.name === 'string' && wanted.has(a.name));
  if (typeof exact?.browser_download_url === 'string') return exact.browser_download_url;
  const anyPacked = assets.find(
    a => typeof a.name === 'string' && /\.(tar\.gz|tgz)$/i.test(a.name)
  );
  return typeof anyPacked?.browser_download_url === 'string'
    ? anyPacked.browser_download_url
    : null;
}

function githubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: ACCEPT,
    'User-Agent': USER_AGENT,
    'X-GitHub-Api-Version': API_VERSION,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function githubGet(path: string, fetchImpl: typeof fetch, token?: string): Promise<Response> {
  return fetchImpl(`${API}${path}`, { headers: githubHeaders(token) });
}

function isPackCandidate(repo: GhRepo): repo is GhRepo & { name: string; html_url: string } {
  if (!repo.name || !repo.html_url) return false;
  if (repo.archived || repo.fork || repo.private) return false;
  return isFirstPartyRepoName(repo.name);
}

async function listOrgPackRepos(fetchImpl: typeof fetch, token?: string): Promise<GhRepo[] | null> {
  const repos: GhRepo[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await githubGet(
      `/orgs/${ORG}/repos?type=public&per_page=${REPOS_PER_PAGE}&page=${page}&sort=full_name`,
      fetchImpl,
      token
    );
    if (!res.ok) return null;
    const pageRepos = (await res.json()) as unknown;
    if (!Array.isArray(pageRepos)) return null;
    repos.push(...(pageRepos as GhRepo[]));
    if (pageRepos.length < REPOS_PER_PAGE) break;
  }
  return repos.filter(isPackCandidate);
}

async function latestPackedRelease(
  repoName: string,
  fetchImpl: typeof fetch,
  token?: string
): Promise<{ version: string; bundleUrl: string; publishedAt: string } | null> {
  const res = await githubGet(`/repos/${ORG}/${repoName}/releases/latest`, fetchImpl, token);
  if (res.status === 404) return null;
  if (res.status === 403 || res.status === 429) {
    throw new Error(`GitHub rate limited (${res.status})`);
  }
  if (!res.ok) return null;
  const release = (await res.json()) as GhRelease;
  const version = versionFromTag(release.tag_name ?? '');
  if (!version) return null;
  const bundleUrl = pickPackedTarball(
    release.assets ?? [],
    [repoName, fallbackSlug(repoName)],
    version
  );
  if (!bundleUrl) return null;
  return {
    version,
    bundleUrl,
    publishedAt: release.published_at ?? new Date().toISOString(),
  };
}

/**
 * @returns discovered packs, or `null` when GitHub is unreachable / rate limited
 * so the caller can fall back to the static seed.
 */
export async function discoverDripnexPacks(options: {
  token?: string;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<DiscoveredPack[] | null> {
  const now = options.now ?? Date.now();
  if (cache && now < cache.until) return cache.packs;

  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const repos = await listOrgPackRepos(fetchImpl, options.token);
    if (!repos) {
      cache = { until: now + GITHUB_PACKS_FAILURE_TTL_MS, packs: null };
      return null;
    }

    const packs: DiscoveredPack[] = [];
    const results = await Promise.allSettled(
      repos.map(async repo => {
        const release = await latestPackedRelease(repo.name!, fetchImpl, options.token);
        if (!release) return null;
        const pack: DiscoveredPack = {
          repoName: repo.name!,
          htmlUrl: repo.html_url!,
          description: repo.description ?? '',
          defaultBranch: repo.default_branch ?? 'main',
          createdAt: repo.created_at ?? new Date().toISOString(),
          updatedAt: release.publishedAt,
          version: release.version,
          bundleUrl: release.bundleUrl,
          kind: packKind(repo.name!),
        };
        return pack;
      })
    );

    let rateLimited = false;
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        packs.push(result.value);
      } else if (result.status === 'rejected') {
        const message =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        if (message.includes('rate limited')) rateLimited = true;
      }
    }

    if (rateLimited && packs.length === 0) {
      cache = { until: now + GITHUB_PACKS_FAILURE_TTL_MS, packs: null };
      return null;
    }

    cache = { until: now + GITHUB_PACKS_TTL_MS, packs };
    return packs;
  } catch {
    cache = { until: now + GITHUB_PACKS_FAILURE_TTL_MS, packs: null };
    return null;
  }
}

/**
 * Cheap manifest read (raw file, not the GitHub REST contents API).
 * Returns null on any failure so callers use {@link fallbackSlug}.
 */
export async function readManifestId(
  repoName: string,
  defaultBranch: string,
  fetchImpl: typeof fetch = fetch
): Promise<string | null> {
  try {
    const res = await fetchImpl(`${RAW}/${ORG}/${repoName}/${defaultBranch}/manifest.json`, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { id?: unknown };
    return typeof body.id === 'string' && body.id.length > 0 ? body.id : null;
  } catch {
    return null;
  }
}

export async function resolveDiscoveredSlug(
  pack: DiscoveredPack,
  overrideSlug: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  if (overrideSlug) return overrideSlug;
  const fromManifest = await readManifestId(pack.repoName, pack.defaultBranch, fetchImpl);
  if (fromManifest) return fromManifest;
  return fallbackSlug(pack.repoName);
}
