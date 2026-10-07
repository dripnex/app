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
 * Complete lists are stored in-process (~12 min), in the Cloudflare Cache
 * API (24h, shared across isolates in a colo), and, when bound, in the
 * `CATALOG_KV` Workers KV namespace (7 days). In-memory alone is why one
 * isolate can serve 30 packs while another falls back to the 21-row seed.
 * Incomplete scans never overwrite a complete list; they reuse last-good
 * (memory, then Cache API, then KV) or return null so the route can use
 * the seed. A missing or throwing KV binding is ignored.
 *
 * A GitHub 401 (expired or revoked `GITHUB_TOKEN`) retries the lookup once
 * without the token. Unauthenticated REST is 60 requests/hour per IP, so
 * the retry is a single best-effort pass and still prefers GraphQL.
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
/** Workers KV last-good list. Longer than the colo Cache API entry. */
export const GITHUB_PACKS_KV_TTL_SECONDS = 7 * 24 * 60 * 60;
const REPOS_PER_PAGE = 100;
const MAX_PAGES = 5;
const LAST_GOOD_CACHE_URL = 'https://api.dripnex.app/__internal/github-packs/last-good';
const LAST_GOOD_KV_KEY = 'github-packs:last-good';

/** Where a non-empty catalog list came from. `fallback` is the static seed. */
export type CatalogSource = 'live' | 'cached' | 'fallback';

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

/**
 * Minimal Workers KV subset. The real `CATALOG_KV` binding satisfies this.
 * Callers must tolerate a missing binding and a throw from either method.
 */
export type CatalogKv = {
  get(key: string, type: 'json'): Promise<unknown>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
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

type CacheEntry = {
  until: number;
  packs: DiscoveredPack[] | null;
  source: 'live' | 'cached';
};

class GithubUnauthorized extends Error {
  constructor() {
    super('GitHub 401');
    this.name = 'GithubUnauthorized';
  }
}

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

function setSource(
  sourceOut: { source: CatalogSource } | undefined,
  source: 'live' | 'cached',
  packs: DiscoveredPack[] | null
): void {
  if (!sourceOut) return;
  sourceOut.source = packs && packs.length > 0 ? source : 'fallback';
}

async function readCacheApi(store: PacksCacheStore | null): Promise<DiscoveredPack[] | null> {
  if (!store) return null;
  try {
    const hit = await store.match(LAST_GOOD_CACHE_URL);
    if (!hit) return null;
    return parseCachedPacks(await hit.json());
  } catch {
    return null;
  }
}

async function readKv(kv: CatalogKv | null | undefined): Promise<DiscoveredPack[] | null> {
  if (!kv) return null;
  try {
    return parseCachedPacks(await kv.get(LAST_GOOD_KV_KEY, 'json'));
  } catch {
    return null;
  }
}

/** Cache API first (fresher, colo-local), then KV (7 days, global). */
async function readLastGood(
  store: PacksCacheStore | null,
  kv: CatalogKv | null | undefined
): Promise<DiscoveredPack[] | null> {
  const fromCache = await readCacheApi(store);
  if (fromCache) return fromCache;
  return readKv(kv);
}

async function writeCacheApi(
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

async function writeKv(kv: CatalogKv | null | undefined, packs: DiscoveredPack[]): Promise<void> {
  if (!kv || packs.length === 0) return;
  try {
    await kv.put(LAST_GOOD_KV_KEY, JSON.stringify(packs), {
      expirationTtl: GITHUB_PACKS_KV_TTL_SECONDS,
    });
  } catch {
    // A missing or failing binding must not fail a successful scan.
  }
}

async function writeLastGood(
  store: PacksCacheStore | null,
  kv: CatalogKv | null | undefined,
  packs: DiscoveredPack[]
): Promise<void> {
  await writeCacheApi(store, packs);
  await writeKv(kv, packs);
}

async function rememberFailure(
  now: number,
  store: PacksCacheStore | null,
  kv: CatalogKv | null | undefined,
  sourceOut?: { source: CatalogSource }
): Promise<DiscoveredPack[] | null> {
  if (!lastGoodFull) lastGoodFull = await readLastGood(store, kv);
  cache = { until: now + GITHUB_PACKS_FAILURE_TTL_MS, packs: lastGoodFull, source: 'cached' };
  setSource(sourceOut, 'cached', lastGoodFull);
  return lastGoodFull;
}

async function rememberSuccess(
  now: number,
  packs: DiscoveredPack[],
  store: PacksCacheStore | null,
  kv: CatalogKv | null | undefined,
  sourceOut?: { source: CatalogSource }
): Promise<DiscoveredPack[]> {
  if (packs.length === 0) {
    if (!lastGoodFull) lastGoodFull = await readLastGood(store, kv);
    const resolved = lastGoodFull ?? packs;
    cache = {
      until: now + GITHUB_PACKS_TTL_MS,
      packs: resolved,
      source: lastGoodFull ? 'cached' : 'live',
    };
    setSource(sourceOut, lastGoodFull ? 'cached' : 'live', resolved);
    return resolved;
  }
  lastGoodFull = packs;
  cache = { until: now + GITHUB_PACKS_TTL_MS, packs, source: 'live' };
  await writeLastGood(store, kv, packs);
  setSource(sourceOut, 'live', packs);
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
): Promise<{ repos: GhRepo[]; truncated: boolean } | 'unauthorized' | null> {
  const repos: GhRepo[] = [];
  let truncated = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await githubGet(
      `/orgs/${ORG}/repos?type=public&per_page=${REPOS_PER_PAGE}&page=${page}&sort=full_name`,
      fetchImpl,
      token
    );
    if (res.status === 401) return 'unauthorized';
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
  if (res.status === 401) throw new GithubUnauthorized();
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
  | { status: 'unavailable' }
  | { status: 'unauthorized' };

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
    if (res.status === 401) return { status: 'unauthorized' };
    if (res.status === 404) return { status: 'unavailable' };
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
  if (listed === 'unauthorized') return { status: 'unauthorized' };
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
  let unauthorized = false;
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      packs.push(result.value);
    } else if (result.status === 'rejected') {
      if (result.reason instanceof GithubUnauthorized) unauthorized = true;
      else rejected = true;
    }
  }

  if (unauthorized) return { status: 'unauthorized' };
  if (rejected || truncated) return { status: 'incomplete' };
  return { status: 'ok', packs };
}

/**
 * GraphQL, then REST. A 401 while a token is set aborts this pass so the
 * caller can retry once with no token instead of walking the org unauthenticated
 * on top of a dead credential (unauthenticated REST is 60 req/hour per IP).
 */
async function scanPacks(fetchImpl: typeof fetch, token?: string): Promise<ScanResult> {
  const graphql = await discoverViaGraphql(fetchImpl, token);
  if (graphql.status === 'ok') return graphql;
  if (graphql.status === 'unauthorized' && token) return graphql;
  return discoverViaRest(fetchImpl, token);
}

/**
 * @returns discovered packs, the last complete list when a scan is incomplete
 * (memory, then Cache API, then `CATALOG_KV`), or `null` when GitHub is
 * unreachable / rate limited with no last-good list so the caller can fall
 * back to the static seed. `sourceOut.source` is `live`, `cached`, or
 * `fallback` (empty / null).
 */
export async function discoverDripnexPacks(options: {
  token?: string;
  fetchImpl?: typeof fetch;
  now?: number;
  cacheStore?: PacksCacheStore | null;
  /** Optional. Missing or throwing bindings are ignored. */
  kv?: CatalogKv | null;
  /** Set when the caller needs `X-Catalog-Source`. */
  sourceOut?: { source: CatalogSource };
}): Promise<DiscoveredPack[] | null> {
  const now = options.now ?? Date.now();
  if (cache && now < cache.until) {
    setSource(options.sourceOut, cache.source, cache.packs);
    return cache.packs;
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const store = options.cacheStore === undefined ? defaultCacheStore() : options.cacheStore;
  const kv = options.kv ?? null;
  try {
    let scan = await scanPacks(fetchImpl, options.token);
    if (scan.status === 'unauthorized' && options.token) {
      scan = await scanPacks(fetchImpl, undefined);
    }
    if (scan.status === 'ok') {
      return rememberSuccess(now, scan.packs, store, kv, options.sourceOut);
    }
    return rememberFailure(now, store, kv, options.sourceOut);
  } catch {
    return rememberFailure(now, store, kv, options.sourceOut);
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
