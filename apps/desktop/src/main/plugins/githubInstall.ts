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

export async function resolveRegistryBundle(
  slug: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ url: string } | { error: string }> {
  let lastError = 'Registry unreachable';
  for (const base of [...new Set(PLUGIN_REGISTRY_URLS)]) {
    try {
      const res = await fetchImpl(
        `${base.replace(/\/$/, '')}/plugins/${encodeURIComponent(slug)}`,
        {
          headers: { Accept: 'application/json', 'User-Agent': 'Dripnex' },
        }
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
        return { url: body.bundleUrl };
      }
      lastError = `Package "${slug}" has no download URL`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { error: lastError };
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
