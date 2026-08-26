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
 * Optional `GITHUB_TOKEN` raises the GitHub REST/GraphQL rate limit.
 * Discovery prefers one GraphQL org query (latestRelease + assets) so a
 * Worker isolate does not N+1 `releases/latest` and 403/429 mid-scan.
 * REST is the fallback when GraphQL is unavailable or incomplete (403/429).
 * Fine-grained PATs often 403 GraphQL `organization { repositories }` while
 * REST `GET /orgs/dripnex/repos` + `releases/latest` still work. Incomplete
 * GraphQL must not skip REST and must never overwrite last-good.
 *
 * Complete lists are stored in-process (~12 min) and in the Cloudflare
 * Cache API (shared across isolates in a colo). In-memory alone is why
 * one isolate can serve 30 packs while another falls back to the 21-row
 * seed. Incomplete scans never overwrite a complete list; they reuse
 * last-good (Cache API, then memory) or return null for the seed.
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
export const GITHUB_PACKS_FAILURE_TTL_MS = 60 * 1000;
/** Shared last-good list (Cache API) outlives a single isolate. */
export const GITHUB_PACKS_LAST_GOOD_TTL_MS = 24 * 60 * 60 * 1000;
const REPOS_PER_PAGE = 100;
const MAX_PAGES = 5;
const LAST_GOOD_CACHE_URL = 'https://api.dripnex.app/__internal/github-packs/last-good';

const GRAPHQL_ORG_REPOS = /* GraphQL */ `
  query DripnexPackRepos($org: String!, $perPage: Int!, $cursor: String) {
    organization(login: $org) {
      repositories(first: $perPage, after: $cursor, privacy: PUBLIC, isFork: false) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          name
          url
          description
          isArchived
          createdAt
          updatedAt
          defaultBranchRef {
            name
          }
          latestRelease {
            tagName
            publishedAt
            releaseAssets(first: 20) {
              nodes {
                name
                downloadUrl
              }
            }
          }
        }
      }
    }
  }
`;

/** Minimal Cache API subset used to share last-good lists across isolates. */
export type PacksCacheStore = {
  match(request: string | URL | Request): Promise<Response | undefined>;
  put(request: string | URL | Request, response: Response): Promise<void>;
};

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
/** Last complete org scan. Partial / rate-limited results never overwrite this. */
let lastGoodFull: DiscoveredPack[] | null = null;

export function resetGithubPacksCache(): void {
  cache = null;
  lastGoodFull = null;
}

function defaultCacheStore(): PacksCacheStore | null {
  try {
    const stores = (globalThis as { caches?: { default?: PacksCacheStore } }).caches;
    return stores?.default ?? null;
  } catch {
    return null;
  }
}

function parseCachedPacks(body: unknown): DiscoveredPack[] | null {
  if (!Array.isArray(body) || body.length === 0) return null;
  const packs: DiscoveredPack[] = [];
  for (const row of body) {
    if (!row || typeof row !== 'object') return null;
    const p = row as Partial<DiscoveredPack>;
    if (
      typeof p.repoName !== 'string' ||
      typeof p.htmlUrl !== 'string' ||
      typeof p.bundleUrl !== 'string' ||
      typeof p.version !== 'string'
    ) {
      return null;
    }
    packs.push({
      repoName: p.repoName,
      htmlUrl: p.htmlUrl,
      description: typeof p.description === 'string' ? p.description : '',
      defaultBranch: typeof p.defaultBranch === 'string' ? p.defaultBranch : 'main',
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
      updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : new Date().toISOString(),
      version: p.version,
      bundleUrl: p.bundleUrl,
      kind: p.kind === 'plugin' ? 'plugin' : 'theme',
    });
  }
  return packs;
}

async function readLastGood(store: PacksCacheStore | null): Promise<DiscoveredPack[] | null> {
  if (!store) return null;
  try {
    const hit = await store.match(LAST_GOOD_CACHE_URL);
    if (!hit) return null;
    return parseCachedPacks(await hit.json());
  } catch {
    return null;
  }
}

async function writeLastGood(
  store: PacksCacheStore | null,
  packs: DiscoveredPack[]
): Promise<void> {
  if (!store) return;
  try {
    const maxAge = Math.floor(GITHUB_PACKS_LAST_GOOD_TTL_MS / 1000);
    await store.put(
      LAST_GOOD_CACHE_URL,
      new Response(JSON.stringify(packs), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `max-age=${maxAge}`,
        },
      })
    );
  } catch {
    // Cache API is best-effort; in-memory last-good still applies in this isolate.
  }
}

async function rememberFailure(
  now: number,
  store: PacksCacheStore | null
): Promise<DiscoveredPack[] | null> {
  if (!lastGoodFull) lastGoodFull = await readLastGood(store);
  cache = { until: now + GITHUB_PACKS_FAILURE_TTL_MS, packs: lastGoodFull };
  return lastGoodFull;
}

async function rememberSuccess(
  now: number,
  packs: DiscoveredPack[],
  store: PacksCacheStore | null
): Promise<DiscoveredPack[]> {
  if (packs.length === 0) {
    if (!lastGoodFull) lastGoodFull = await readLastGood(store);
    cache = { until: now + GITHUB_PACKS_TTL_MS, packs: lastGoodFull ?? packs };
    return lastGoodFull ?? packs;
  }
  lastGoodFull = packs;
  cache = { until: now + GITHUB_PACKS_TTL_MS, packs };
  await writeLastGood(store, packs);
  return packs;
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
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '')
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

async function listOrgPackRepos(
  fetchImpl: typeof fetch,
  token?: string
): Promise<{ repos: GhRepo[]; truncated: boolean } | null> {
  const repos: GhRepo[] = [];
  let truncated = false;
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
    if (pageRepos.length < REPOS_PER_PAGE) {
      truncated = false;
      break;
    }
    if (page === MAX_PAGES) truncated = true;
  }
  return { repos: repos.filter(isPackCandidate), truncated };
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

type GraphqlNode = {
  name?: string | null;
  url?: string | null;
  description?: string | null;
  isArchived?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  defaultBranchRef?: { name?: string | null } | null;
  latestRelease?: {
    tagName?: string | null;
    publishedAt?: string | null;
    releaseAssets?: {
      nodes?: Array<{ name?: string | null; downloadUrl?: string | null } | null> | null;
    } | null;
  } | null;
};

type ScanResult =
  | { status: 'ok'; packs: DiscoveredPack[] }
  | { status: 'incomplete' }
  | { status: 'unavailable' };

function packFromGraphqlNode(node: GraphqlNode): DiscoveredPack | null {
  const name = node.name ?? '';
  const htmlUrl = node.url ?? '';
  if (!name || !htmlUrl || node.isArchived) return null;
  if (!isFirstPartyRepoName(name)) return null;
  const release = node.latestRelease;
  const tagName = release?.tagName ?? '';
  const version = versionFromTag(tagName);
  if (!version) return null;
  const assets = (release?.releaseAssets?.nodes ?? [])
    .filter(
      (a): a is { name: string; downloadUrl: string } =>
        !!a &&
        typeof a.name === 'string' &&
        typeof a.downloadUrl === 'string' &&
        a.downloadUrl.length > 0
    )
    .map(a => ({
      name: a.name,
      browser_download_url: a.downloadUrl,
    }));
  const bundleUrl = pickPackedTarball(assets, [name, fallbackSlug(name)], version);
  if (!bundleUrl) return null;
  return {
    repoName: name,
    htmlUrl,
    description: node.description ?? '',
    defaultBranch: node.defaultBranchRef?.name ?? 'main',
    createdAt: node.createdAt ?? new Date().toISOString(),
    updatedAt: release?.publishedAt ?? node.updatedAt ?? new Date().toISOString(),
    version,
    bundleUrl,
    kind: packKind(name),
  };
}

async function discoverViaGraphql(fetchImpl: typeof fetch, token?: string): Promise<ScanResult> {
  const packs: DiscoveredPack[] = [];
  let cursor: string | null = null;
  for (let page = 1; page <= MAX_PAGES; page++) {
    let res: Response;
    try {
      res = await fetchImpl(`${API}/graphql`, {
        method: 'POST',
        headers: { ...githubHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: GRAPHQL_ORG_REPOS,
          variables: { org: ORG, perPage: REPOS_PER_PAGE, cursor },
        }),
      });
    } catch {
      return { status: 'unavailable' };
    }
    if (res.status === 401 || res.status === 404) return { status: 'unavailable' };
    if (res.status === 403 || res.status === 429) return { status: 'incomplete' };
    if (!res.ok) return { status: 'unavailable' };
    const body = (await res.json()) as {
      errors?: unknown;
      data?: {
        organization?: {
          repositories?: {
            pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
            nodes?: Array<GraphqlNode | null> | null;
          };
        } | null;
      };
    };
    if (body.errors || !body.data?.organization?.repositories) return { status: 'unavailable' };
    const conn = body.data.organization.repositories;
    for (const node of conn.nodes ?? []) {
      if (!node) continue;
      const pack = packFromGraphqlNode(node);
      if (pack) packs.push(pack);
    }
    if (!conn.pageInfo?.hasNextPage) return { status: 'ok', packs };
    cursor = conn.pageInfo.endCursor ?? null;
    if (!cursor) return { status: 'ok', packs };
    if (page === MAX_PAGES) return { status: 'incomplete' };
  }
  return { status: 'ok', packs };
}

async function discoverViaRest(fetchImpl: typeof fetch, token?: string): Promise<ScanResult> {
  const listed = await listOrgPackRepos(fetchImpl, token);
  if (!listed) return { status: 'unavailable' };

  const { repos, truncated } = listed;
  const packs: DiscoveredPack[] = [];
  const results = await Promise.allSettled(
    repos.map(async repo => {
      const release = await latestPackedRelease(repo.name!, fetchImpl, token);
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

  let rejected = false;
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      packs.push(result.value);
    } else if (result.status === 'rejected') {
      rejected = true;
    }
  }

  if (rejected || truncated) return { status: 'incomplete' };
  return { status: 'ok', packs };
}

/**
 * @returns discovered packs, the last complete list when a scan is incomplete,
 * or `null` when GitHub is unreachable / rate limited with no last-good list
 * so the caller can fall back to the static seed.
 */
export async function discoverDripnexPacks(options: {
  token?: string;
  fetchImpl?: typeof fetch;
  now?: number;
  cacheStore?: PacksCacheStore | null;
}): Promise<DiscoveredPack[] | null> {
  const now = options.now ?? Date.now();
  if (cache && now < cache.until) return cache.packs;

  const fetchImpl = options.fetchImpl ?? fetch;
  const store = options.cacheStore === undefined ? defaultCacheStore() : options.cacheStore;
  try {
    const graphql = await discoverViaGraphql(fetchImpl, options.token);
    if (graphql.status === 'ok') return rememberSuccess(now, graphql.packs, store);

    const rest = await discoverViaRest(fetchImpl, options.token);
    if (rest.status === 'ok') return rememberSuccess(now, rest.packs, store);
    return rememberFailure(now, store);
  } catch {
    return rememberFailure(now, store);
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
