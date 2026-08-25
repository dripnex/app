import {
  isDripnexPackRepository,
  isReservedFirstPartySlug,
  isTrustedFirstPartyBundleUrl,
} from '../../shared/firstPartyPacks';

export type ConnectSpec =
  | { kind: 'github'; owner: string; repo: string; tag?: string }
  | { kind: 'url'; url: string }
  | { kind: 'registry'; slug: string; tag?: string };

/**
 * First-party packs whose manifest id / registry slug is not `owner/repo`.
 * Install must hit the GitHub tarball even when GET /plugins/:slug 404s (#562).
 */
export const OFFICIAL_PACK_REPOS: Record<string, `${string}/${string}`> = {
  'dripnex-vim-mode': 'dripnex/plugin-vim',
  mermaid: 'dripnex/plugin-mermaid',
  math: 'dripnex/plugin-math',
  stamp: 'dripnex/plugin-stamp',
  'theme-parchment': 'dripnex/theme-parchment',
  'theme-harbor-dusk': 'dripnex/theme-harbor-dusk',
  'theme-wave': 'dripnex/theme-wave',
  'theme-night': 'dripnex/theme-night',
  'theme-solarized-dark': 'dripnex/theme-solarized-dark',
  'theme-solarized-light': 'dripnex/theme-solarized-light',
  'theme-gruvbox': 'dripnex/theme-gruvbox',
  'theme-glass': 'dripnex/theme-glass',
  'theme-midnight': 'dripnex/theme-midnight',
  'theme-ember': 'dripnex/theme-ember',
  'theme-ion': 'dripnex/theme-ion',
  'theme-matcha': 'dripnex/theme-matcha',
  'theme-phosphor': 'dripnex/theme-phosphor',
  'theme-fog': 'dripnex/theme-fog',
};

export function officialRepoForSlug(slug: string): { owner: string; repo: string } | null {
  const spec = OFFICIAL_PACK_REPOS[slug];
  if (!spec) return null;
  const [owner, repo] = spec.split('/');
  return owner && repo ? { owner, repo } : null;
}

export const PLUGIN_REGISTRY_URLS = [
  process.env.DRIPNEX_API_URL,
  'https://api.dripnex.app',
  'https://readied-api-production.readied.workers.dev',
].filter((u): u is string => Boolean(u));

export function parseConnectSpec(source: string): ConnectSpec | { error: string } {
  const trimmed = source.trim();
  if (!trimmed) return { error: 'Enter owner/repo or a release URL' };
  if (/\s/.test(trimmed)) return { error: 'Spec cannot contain spaces' };

  if (/^https:\/\//i.test(trimmed)) {
    if (/\/releases\/download\//i.test(trimmed)) {
      return { kind: 'url', url: trimmed };
    }
    const gh = trimmed.match(/^https:\/\/github\.com\/([^/]+)\/([^/?#]+)/i);
    if (gh) {
      const tag = trimmed.match(/\/releases\/(?:tag|download)\/([^/?#]+)/i)?.[1];
      return {
        kind: 'github',
        owner: gh[1] ?? '',
        repo: (gh[2] ?? '').replace(/\.git$/i, ''),
        tag,
      };
    }
    return { error: 'Only GitHub repos or HTTPS release archives' };
  }

  if (/^http:/i.test(trimmed)) {
    return { error: 'Only HTTPS URLs are allowed' };
  }

  const prefixed = trimmed.match(/^github:([^/]+)\/([^@]+)(?:@(.+))?$/i);
  if (prefixed) {
    return {
      kind: 'github',
      owner: prefixed[1] ?? '',
      repo: prefixed[2] ?? '',
      tag: prefixed[3],
    };
  }

  const repo = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:@(.+))?$/);
  if (repo) {
    return {
      kind: 'github',
      owner: repo[1] ?? '',
      repo: repo[2] ?? '',
      tag: repo[3],
    };
  }

  const registry = trimmed.match(/^([a-z][a-z0-9]*(-[a-z0-9]+)*)(?:@(.+))?$/);
  if (registry) {
    const slug = registry[1] ?? '';
    const tag = registry[3];
    const official = officialRepoForSlug(slug);
    if (official) {
      return { kind: 'github', owner: official.owner, repo: official.repo, tag };
    }
    return { kind: 'registry', slug, tag };
  }

  return { error: 'Use a package name (stamp), owner/repo, or a GitHub release URL' };
}

export function uniqueReleaseTags(tag: string): string[] {
  const withV = tag.startsWith('v') ? tag : `v${tag}`;
  const withoutV = tag.startsWith('v') ? tag.slice(1) : tag;
  return [...new Set([tag, withV, withoutV])];
}

export function pickReleaseTarball(
  assets: Array<{ name?: string; browser_download_url?: string }>
): string | null {
  const asset = assets.find(a => typeof a.name === 'string' && /\.(tar\.gz|tgz)$/i.test(a.name));
  return typeof asset?.browser_download_url === 'string' ? asset.browser_download_url : null;
}

const REGISTRY_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Dripnex',
  'Cache-Control': 'no-cache',
};

export type RegistryPlugin = {
  slug: string;
  name: string;
  description: string;
  version: string;
  author: string;
  repositoryUrl: string | null;
  bundleUrl: string | null;
};

export function isFirstPartyGithubRepo(owner: string, repo: string): boolean {
  return isDripnexPackRepository(`${owner}/${repo}`);
}

export function fallbackSlug(repoName: string): string {
  if (repoName === 'plugin-vim') return 'dripnex-vim-mode';
  if (repoName.startsWith('theme-')) return repoName;
  if (repoName.startsWith('plugin-')) return repoName.slice('plugin-'.length);
  return repoName;
}

export function firstPartySlugCandidates(owner: string, repo: string): string[] {
  const slugs: string[] = [];
  const needle = `${owner.toLowerCase()}/${repo}`;
  for (const [slug, spec] of Object.entries(OFFICIAL_PACK_REPOS)) {
    if (spec.toLowerCase() === needle) slugs.push(slug);
  }
  slugs.push(repo);
  const fallback = fallbackSlug(repo);
  if (fallback !== repo) slugs.push(fallback);
  return [...new Set(slugs)];
}

export async function resolveRegistryBundle(
  slug: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ url: string } | { error: string }> {
  let lastError = 'Registry unreachable';
  for (const base of [...new Set(PLUGIN_REGISTRY_URLS)]) {
    try {
      const res = await fetchImpl(
        `${base.replace(/\/$/, '')}/plugins/${encodeURIComponent(slug)}`,
        { headers: REGISTRY_HEADERS, cache: 'no-store' }
      );
      if (res.status === 404) {
        lastError = `Package "${slug}" is not in the registry`;
        continue;
      }
      if (!res.ok) {
        lastError = `Registry returned ${res.status}`;
        continue;
      }
      const body = (await res.json()) as { bundleUrl?: string };
      if (body.bundleUrl?.startsWith('https://')) {
        if (isReservedFirstPartySlug(slug) && !isTrustedFirstPartyBundleUrl(body.bundleUrl)) {
          lastError = `Package "${slug}" listed an untrusted download URL`;
          continue;
        }
        return { url: body.bundleUrl };
      }
      lastError = `Package "${slug}" has no download URL`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { error: lastError };
}

export function parseRegistryPlugins(body: unknown): RegistryPlugin[] | null {
  if (!body || typeof body !== 'object') return null;
  const plugins = (body as { plugins?: unknown }).plugins;
  if (!Array.isArray(plugins)) return null;
  return plugins
    .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
    .map(p => ({
      slug: typeof p.slug === 'string' ? p.slug : '',
      name: typeof p.name === 'string' ? p.name : '',
      description: typeof p.description === 'string' ? p.description : '',
      version: typeof p.version === 'string' ? p.version : '',
      author: typeof p.author === 'string' ? p.author : '',
      repositoryUrl: typeof p.repositoryUrl === 'string' ? p.repositoryUrl : null,
      bundleUrl: typeof p.bundleUrl === 'string' ? p.bundleUrl : null,
    }))
    .filter(p => p.slug.length > 0);
}

export async function fetchRegistryOnce(
  base: string,
  fetchImpl: typeof fetch
): Promise<RegistryPlugin[] | null> {
  try {
    const res = await fetchImpl(`${base.replace(/\/$/, '')}/plugins`, {
      headers: REGISTRY_HEADERS,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return parseRegistryPlugins(await res.json());
  } catch {
    return null;
  }
}

/**
 * Hit every registry host and keep the longest list. Worker in-memory
 * discovery is per-isolate: api.dripnex.app can return the 21-row seed
 * while workers.dev (or a retry) returns the complete live catalog.
 */
export async function fetchRegistryCatalog(
  fetchImpl: typeof fetch
): Promise<RegistryPlugin[] | null> {
  const lists = (
    await Promise.all(
      [...new Set(PLUGIN_REGISTRY_URLS)].map(base => fetchRegistryOnce(base, fetchImpl))
    )
  ).filter((list): list is RegistryPlugin[] => Array.isArray(list) && list.length > 0);
  if (lists.length === 0) return null;
  return lists.reduce((best, cur) => (cur.length > best.length ? cur : best));
}

export async function resolveFirstPartyBundle(
  owner: string,
  repo: string,
  fetchImpl: typeof fetch
): Promise<{ url: string } | { error: string }> {
  for (const slug of firstPartySlugCandidates(owner, repo)) {
    const resolved = await resolveRegistryBundle(slug, fetchImpl);
    if ('url' in resolved && isTrustedFirstPartyBundleUrl(resolved.url)) return resolved;
  }
  const catalog = await fetchRegistryCatalog(fetchImpl);
  const repoUrl = `https://github.com/${owner}/${repo}`.toLowerCase();
  const hit = catalog?.find(p => {
    const remote = (p.repositoryUrl ?? '')
      .replace(/\.git$/i, '')
      .replace(/\/+$/, '')
      .toLowerCase();
    return remote === repoUrl || p.slug === repo;
  });
  if (hit?.bundleUrl && isTrustedFirstPartyBundleUrl(hit.bundleUrl)) {
    return { url: hit.bundleUrl };
  }
  return { error: `Package ${owner}/${repo} is not in the Dripnex registry` };
}

export async function resolveGithubRelease(
  owner: string,
  repo: string,
  tag: string | undefined,
  fetchImpl: typeof fetch
): Promise<{ url: string } | { error: string }> {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Dripnex',
  };
  const urls = tag
    ? uniqueReleaseTags(tag).map(
        t => `https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(t)}`
      )
    : [`https://api.github.com/repos/${owner}/${repo}/releases/latest`];

  let lastStatus = 0;
  for (const api of urls) {
    const res = await fetchImpl(api, { headers });
    lastStatus = res.status;
    if (res.status === 404) continue;
    if (!res.ok) return { error: `GitHub returned ${res.status} for ${owner}/${repo}` };
    const body = (await res.json()) as {
      tag_name?: string;
      assets?: Array<{ name?: string; browser_download_url?: string }>;
    };
    const tarball = pickReleaseTarball(body.assets ?? []);
    if (!tarball) {
      return {
        error: `Release ${body.tag_name ?? tag ?? 'latest'} of ${owner}/${repo} has no .tar.gz. Authors: dripnex-plugin pack.`,
      };
    }
    return { url: tarball };
  }

  return {
    error: `No GitHub release found for ${owner}/${repo}${tag ? `@${tag}` : ''}${lastStatus ? ` (${lastStatus})` : ''}.`,
  };
}

export async function resolveConnectUrl(
  spec: Exclude<ReturnType<typeof parseConnectSpec>, { error: string }>,
  fetchImpl: typeof fetch
): Promise<{ url: string } | { error: string }> {
  if (spec.kind === 'registry') {
    return resolveRegistryBundle(spec.slug, fetchImpl);
  }

  if (spec.kind === 'url') {
    let hostname: string;
    try {
      hostname = new URL(spec.url).hostname;
    } catch {
      return { error: 'Invalid URL' };
    }
    if (!isAllowedPluginHost(hostname)) {
      return { error: 'Only GitHub release archives are allowed' };
    }
    return { url: spec.url };
  }

  if (isFirstPartyGithubRepo(spec.owner, spec.repo)) {
    return resolveFirstPartyBundle(spec.owner, spec.repo, fetchImpl);
  }

  return resolveGithubRelease(spec.owner, spec.repo, spec.tag, fetchImpl);
}

export function isAllowedPluginHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === 'github.com' ||
    h === 'api.github.com' ||
    h.endsWith('.githubusercontent.com') ||
    h === 'api.dripnex.app' ||
    h.endsWith('.workers.dev')
  );
}
