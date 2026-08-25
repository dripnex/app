import { describe, expect, it } from 'vitest';
import {
  fetchRegistryCatalog,
  isAllowedPluginHost,
  isFirstPartyGithubRepo,
  parseConnectSpec,
  pickReleaseTarball,
  resolveConnectUrl,
  uniqueReleaseTags,
} from '../githubInstall';

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function pathnameOf(url: string): string | null {
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

describe('parseConnectSpec', () => {
  it('parses owner/repo and tag', () => {
    expect(parseConnectSpec('acme/plug')).toEqual({ kind: 'github', owner: 'acme', repo: 'plug' });
    expect(parseConnectSpec('acme/plug@v1.2.3')).toEqual({
      kind: 'github',
      owner: 'acme',
      repo: 'plug',
      tag: 'v1.2.3',
    });
  });

  it('parses a registry slug', () => {
    expect(parseConnectSpec('acme-plug')).toEqual({ kind: 'registry', slug: 'acme-plug' });
    expect(parseConnectSpec('acme-plug@0.1.0')).toEqual({
      kind: 'registry',
      slug: 'acme-plug',
      tag: '0.1.0',
    });
  });

  it('resolves official slugs to the GitHub owner/repo (#562)', () => {
    expect(parseConnectSpec('dripnex-vim-mode')).toEqual({
      kind: 'github',
      owner: 'dripnex',
      repo: 'plugin-vim',
    });
    expect(parseConnectSpec('dripnex-vim-mode@1.2.0')).toEqual({
      kind: 'github',
      owner: 'dripnex',
      repo: 'plugin-vim',
      tag: '1.2.0',
    });
    expect(parseConnectSpec('mermaid')).toEqual({
      kind: 'github',
      owner: 'dripnex',
      repo: 'plugin-mermaid',
    });
    expect(parseConnectSpec('math')).toEqual({
      kind: 'github',
      owner: 'dripnex',
      repo: 'plugin-math',
    });
    expect(parseConnectSpec('theme-parchment')).toEqual({
      kind: 'github',
      owner: 'dripnex',
      repo: 'theme-parchment',
    });
    expect(parseConnectSpec('theme-harbor-dusk')).toEqual({
      kind: 'github',
      owner: 'dripnex',
      repo: 'theme-harbor-dusk',
    });
    expect(parseConnectSpec('dripnex/plugin-vim')).toEqual({
      kind: 'github',
      owner: 'dripnex',
      repo: 'plugin-vim',
    });
  });

  it('parses GitHub URLs and rejects anything else', () => {
    expect(parseConnectSpec('https://github.com/acme/plug')).toEqual({
      kind: 'github',
      owner: 'acme',
      repo: 'plug',
    });
    expect(parseConnectSpec('https://evil.example/x.tar.gz')).toEqual({
      error: 'Only GitHub repos or HTTPS release archives',
    });
    expect(parseConnectSpec('not a spec')).toEqual({
      error: 'Spec cannot contain spaces',
    });
  });
});

describe('pickReleaseTarball', () => {
  it('picks the first tar.gz asset', () => {
    expect(
      pickReleaseTarball([
        { name: 'notes.txt', browser_download_url: 'https://x/notes.txt' },
        { name: 'plug-1.0.0.tar.gz', browser_download_url: 'https://x/plug-1.0.0.tar.gz' },
      ])
    ).toBe('https://x/plug-1.0.0.tar.gz');
  });
});

describe('uniqueReleaseTags', () => {
  it('tries v-prefixed and bare tags', () => {
    expect(uniqueReleaseTags('1.0.0')).toEqual(['1.0.0', 'v1.0.0']);
    expect(uniqueReleaseTags('v1.0.0')).toEqual(['v1.0.0', '1.0.0']);
  });
});

describe('isFirstPartyGithubRepo', () => {
  it('matches dripnex theme and plugin satellites', () => {
    expect(isFirstPartyGithubRepo('dripnex', 'theme-limestone')).toBe(true);
    expect(isFirstPartyGithubRepo('dripnex', 'plugin-vim')).toBe(true);
    expect(isFirstPartyGithubRepo('acme', 'theme-limestone')).toBe(false);
    expect(isFirstPartyGithubRepo('dripnex', 'app')).toBe(false);
  });
});

describe('fetchRegistryCatalog', () => {
  it('keeps the longest GET /plugins list across registry hosts', async () => {
    const seed21 = Array.from({ length: 21 }, (_, i) => ({
      slug: i === 0 ? 'theme-parchment' : `seed-${i}`,
      name: `Seed ${i}`,
      description: '',
      version: '0.1.0',
      author: 'Dripnex',
    }));
    const live30 = [
      ...seed21,
      {
        slug: 'theme-limestone',
        name: 'Limestone',
        description: '',
        version: '0.1.0',
        author: 'Dripnex',
        repositoryUrl: 'https://github.com/dripnex/theme-limestone',
        bundleUrl:
          'https://github.com/dripnex/theme-limestone/releases/download/v0.1.0/theme-limestone-0.1.0.tar.gz',
      },
      ...Array.from({ length: 8 }, (_, i) => ({
        slug: `extra-${i}`,
        name: `Extra ${i}`,
        description: '',
        version: '0.1.0',
        author: 'Dripnex',
      })),
    ];
    expect(live30).toHaveLength(30);

    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = String(input);
      const host = hostnameOf(url);
      const path = pathnameOf(url);
      if (host === 'api.dripnex.app' && path === '/plugins') {
        return new Response(JSON.stringify({ plugins: seed21, total: 21 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (host === 'readied-api-production.readied.workers.dev' && path === '/plugins') {
        return new Response(JSON.stringify({ plugins: live30, total: 30 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    };

    const catalog = await fetchRegistryCatalog(fetchImpl);
    expect(catalog).toHaveLength(30);
    expect(catalog?.some(p => p.slug === 'theme-limestone')).toBe(true);
  });
});

describe('resolveConnectUrl', () => {
  it('resolves dripnex/theme-* via the Worker catalog, never api.github.com', async () => {
    const called: string[] = [];
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = String(input);
      called.push(url);
      if (hostnameOf(url) === 'api.dripnex.app' && pathnameOf(url) === '/plugins/theme-limestone') {
        return new Response(
          JSON.stringify({
            slug: 'theme-limestone',
            bundleUrl:
              'https://github.com/dripnex/theme-limestone/releases/download/v0.1.0/theme-limestone-0.1.0.tar.gz',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    };

    const spec = parseConnectSpec('dripnex/theme-limestone');
    expect('error' in spec).toBe(false);
    if ('error' in spec) return;
    const resolved = await resolveConnectUrl(spec, fetchImpl);
    expect(resolved).toEqual({
      url: 'https://github.com/dripnex/theme-limestone/releases/download/v0.1.0/theme-limestone-0.1.0.tar.gz',
    });
    expect(called.every(u => hostnameOf(u) !== 'api.github.com')).toBe(true);
    expect(
      called.some(
        u => hostnameOf(u) === 'api.dripnex.app' && pathnameOf(u) === '/plugins/theme-limestone'
      )
    ).toBe(true);
  });

  it('rejects a first-party registry bundleUrl that is not a dripnex GitHub release', async () => {
    const attacker =
      'https://github.com/attacker/theme-limestone/releases/download/v9.9.9/theme-limestone-9.9.9.tar.gz';
    const called: string[] = [];
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = String(input);
      called.push(url);
      if (hostnameOf(url) === 'api.dripnex.app' && pathnameOf(url) === '/plugins/theme-limestone') {
        return new Response(
          JSON.stringify({
            slug: 'theme-limestone',
            bundleUrl: attacker,
            repositoryUrl: 'https://github.com/dripnex/theme-limestone',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (hostnameOf(url) === 'api.dripnex.app' && pathnameOf(url) === '/plugins') {
        return new Response(
          JSON.stringify({
            plugins: [
              {
                slug: 'theme-limestone',
                bundleUrl: attacker,
                repositoryUrl: 'https://github.com/dripnex/theme-limestone',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    };

    const spec = parseConnectSpec('dripnex/theme-limestone');
    expect('error' in spec).toBe(false);
    if ('error' in spec) return;
    const resolved = await resolveConnectUrl(spec, fetchImpl);
    expect('error' in resolved).toBe(true);
    if ('error' in resolved) {
      expect(resolved.error).toMatch(/not in the Dripnex registry/i);
    }
    expect(called.every(u => hostnameOf(u) !== 'api.github.com')).toBe(true);
  });

  it('keeps a known GitHub tarball URL without calling GitHub API', async () => {
    const called: string[] = [];
    const fetchImpl = async (input: RequestInfo | URL) => {
      called.push(String(input));
      return new Response('nope', { status: 500 });
    };
    const url =
      'https://github.com/dripnex/theme-limestone/releases/download/v0.1.0/theme-limestone-0.1.0.tar.gz';
    const spec = parseConnectSpec(url);
    expect('error' in spec).toBe(false);
    if ('error' in spec) return;
    const resolved = await resolveConnectUrl(spec, fetchImpl);
    expect(resolved).toEqual({ url });
    expect(called).toEqual([]);
  });

  it('still uses GitHub API for third-party owner/repo', async () => {
    const called: string[] = [];
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = String(input);
      called.push(url);
      return new Response(
        JSON.stringify({
          tag_name: 'v1.0.0',
          assets: [
            {
              name: 'plug-1.0.0.tar.gz',
              browser_download_url:
                'https://github.com/acme/plug/releases/download/v1.0.0/plug-1.0.0.tar.gz',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };
    const spec = parseConnectSpec('acme/plug');
    expect('error' in spec).toBe(false);
    if ('error' in spec) return;
    const resolved = await resolveConnectUrl(spec, fetchImpl);
    expect(resolved).toEqual({
      url: 'https://github.com/acme/plug/releases/download/v1.0.0/plug-1.0.0.tar.gz',
    });
    expect(
      called.some(
        u =>
          hostnameOf(u) === 'api.github.com' && pathnameOf(u) === '/repos/acme/plug/releases/latest'
      )
    ).toBe(true);
  });
});

describe('isAllowedPluginHost', () => {
  it('allows GitHub and the Dripnex registry hosts', () => {
    expect(isAllowedPluginHost('github.com')).toBe(true);
    expect(isAllowedPluginHost('objects.githubusercontent.com')).toBe(true);
    expect(isAllowedPluginHost('api.dripnex.app')).toBe(true);
    expect(isAllowedPluginHost('readied-api-production.readied.workers.dev')).toBe(true);
    expect(isAllowedPluginHost('evil.example')).toBe(false);
  });
});
