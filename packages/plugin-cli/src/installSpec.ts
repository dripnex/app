export type InstallSpec =
  | { kind: 'path'; path: string }
  | { kind: 'url'; url: string }
  | { kind: 'github'; owner: string; repo: string; tag?: string }
  | { kind: 'registry'; slug: string; tag?: string };

/** Same map as desktop `OFFICIAL_PACK_REPOS` — slug is not a GitHub repo (#562). */
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

/**
 * Resolve what `dripnex-plugin install <spec>` means.
 *
 * Local paths win when they exist. Otherwise `owner/repo[@tag]`,
 * `github:owner/repo[@tag]`, a GitHub URL, or any https archive URL.
 */
export function parseInstallSource(
  source: string,
  pathExists: (p: string) => boolean
): InstallSpec {
  const trimmed = source.trim();
  if (!trimmed) {
    throw new Error('empty install spec');
  }

  if (pathExists(trimmed)) {
    return { kind: 'path', path: trimmed };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    if (/\/releases\/download\//i.test(trimmed)) {
      return { kind: 'url', url: trimmed };
    }
    const gh = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)/i);
    if (gh) {
      const tag = trimmed.match(/\/releases\/(?:tag|download)\/([^/?#]+)/i)?.[1];
      return {
        kind: 'github',
        owner: gh[1] ?? '',
        repo: (gh[2] ?? '').replace(/\.git$/i, ''),
        tag,
      };
    }
    return { kind: 'url', url: trimmed };
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

  return { kind: 'path', path: trimmed };
}
