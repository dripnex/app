import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import app from '../src/index.js';
import {
  discoverDripnexPacks,
  fallbackSlug,
  GITHUB_PACKS_FAILURE_TTL_MS,
  GITHUB_PACKS_TTL_MS,
  isFirstPartyRepoName,
  pickPackedTarball,
  resetGithubPacksCache,
  type PacksCacheStore,
} from '../src/services/githubPacks.js';
import {
  createTestEnv,
  initTestDb,
  cleanupTestDb,
  seedFreeUser,
  createAccessToken,
  authHeader,
} from './helpers.js';

const { env } = createTestEnv();

describe('first-party pack discovery helpers', () => {
  it('does not treat random org repos as packs', () => {
    expect(isFirstPartyRepoName('app')).toBe(false);
    expect(isFirstPartyRepoName('marketing')).toBe(false);
    expect(isFirstPartyRepoName('docs-site')).toBe(false);
    expect(isFirstPartyRepoName('theme-parchment')).toBe(true);
    expect(isFirstPartyRepoName('plugin-vim')).toBe(true);
  });

  it('uses documented slug fallbacks', () => {
    expect(fallbackSlug('theme-newpack')).toBe('theme-newpack');
    expect(fallbackSlug('plugin-vim')).toBe('dripnex-vim-mode');
    expect(fallbackSlug('plugin-stamp')).toBe('stamp');
  });

  it('picks the packed Release asset, never a git source tarball stand-in', () => {
    expect(pickPackedTarball([], ['theme-newpack'], '0.1.0')).toBeNull();
    expect(
      pickPackedTarball(
        [
          {
            name: 'theme-newpack-0.1.0.tar.gz',
            browser_download_url:
              'https://github.com/dripnex/theme-newpack/releases/download/v0.1.0/theme-newpack-0.1.0.tar.gz',
          },
        ],
        ['theme-newpack'],
        '0.1.0'
      )
    ).toBe(
      'https://github.com/dripnex/theme-newpack/releases/download/v0.1.0/theme-newpack-0.1.0.tar.gz'
    );
  });
});

function packedRepo(name: string) {
  return {
    name,
    html_url: `https://github.com/dripnex/${name}`,
    description: name,
    default_branch: 'main',
    created_at: '2026-08-25T00:00:00.000Z',
    updated_at: '2026-08-25T00:00:00.000Z',
    archived: false,
    fork: false,
    private: false,
  };
}

function packedRelease(name: string): Response {
  return jsonResponse(200, {
    tag_name: 'v0.1.0',
    published_at: '2026-08-25T00:00:00.000Z',
    assets: [
      {
        name: `${name}-0.1.0.tar.gz`,
        browser_download_url: `https://github.com/dripnex/${name}/releases/download/v0.1.0/${name}-0.1.0.tar.gz`,
      },
    ],
  });
}

function graphqlPackedNode(name: string) {
  return {
    name,
    url: `https://github.com/dripnex/${name}`,
    description: name,
    isArchived: false,
    createdAt: '2026-08-25T00:00:00.000Z',
    updatedAt: '2026-08-25T00:00:00.000Z',
    defaultBranchRef: { name: 'main' },
    latestRelease: {
      tagName: 'v0.1.0',
      publishedAt: '2026-08-25T00:00:00.000Z',
      releaseAssets: { nodes: [{ name: `${name}-0.1.0.tar.gz` }] },
    },
  };
}

function createMemoryPacksCache(): PacksCacheStore {
  const map = new Map<string, { body: string; until: number }>();
  const keyOf = (req: string | URL | Request) =>
    typeof req === 'string' ? req : req instanceof Request ? req.url : String(req);
  return {
    async match(req) {
      const hit = map.get(keyOf(req));
      if (!hit || Date.now() > hit.until) return undefined;
      return new Response(hit.body, { headers: { 'Content-Type': 'application/json' } });
    },
    async put(req, response) {
      const cc = response.headers.get('Cache-Control') ?? '';
      const maxAge = Number(/max-age=(\d+)/.exec(cc)?.[1] ?? '3600');
      map.set(keyOf(req), {
        body: await response.clone().text(),
        until: Date.now() + maxAge * 1000,
      });
    },
  };
}

describe('discoverDripnexPacks cache', () => {
  beforeEach(() => {
    resetGithubPacksCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetGithubPacksCache();
  });

  it('does not cache a mid-scan 403 as a shorter success list', async () => {
    const t0 = 1_000_000;
    let phase: 'full' | 'partial' = 'full';
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/orgs/dripnex/repos')) {
        return jsonResponse(200, [packedRepo('theme-alpha'), packedRepo('theme-beta')]);
      }
      if (url.includes('/repos/dripnex/theme-alpha/releases/latest')) {
        return packedRelease('theme-alpha');
      }
      if (url.includes('/repos/dripnex/theme-beta/releases/latest')) {
        if (phase === 'partial') {
          return jsonResponse(403, { message: 'API rate limit exceeded' });
        }
        return packedRelease('theme-beta');
      }
      return jsonResponse(404, { message: 'Not Found' });
    });

    const first = await discoverDripnexPacks({ fetchImpl, now: t0 });
    expect(first?.map(p => p.repoName).sort()).toEqual(['theme-alpha', 'theme-beta']);

    phase = 'partial';
    const afterTtl = await discoverDripnexPacks({
      fetchImpl,
      now: t0 + GITHUB_PACKS_TTL_MS + 1,
    });
    expect(afterTtl?.map(p => p.repoName).sort()).toEqual(['theme-alpha', 'theme-beta']);
    expect(afterTtl).toHaveLength(2);

    const fetchCountAfterPartial = fetchImpl.mock.calls.length;
    const withinSuccessTtl = await discoverDripnexPacks({
      fetchImpl,
      now: t0 + GITHUB_PACKS_TTL_MS + 2,
    });
    expect(withinSuccessTtl?.map(p => p.repoName).sort()).toEqual(['theme-alpha', 'theme-beta']);
    expect(withinSuccessTtl).toHaveLength(2);
    expect(fetchImpl.mock.calls.length).toBe(fetchCountAfterPartial);

    await discoverDripnexPacks({
      fetchImpl,
      now: t0 + GITHUB_PACKS_TTL_MS + 1 + GITHUB_PACKS_FAILURE_TTL_MS + 1,
    });
    expect(fetchImpl.mock.calls.length).toBeGreaterThan(fetchCountAfterPartial);
  });

  it('reuses a shared last-good list when a cold isolate would otherwise seed', async () => {
    const t0 = 2_000_000;
    const shared = createMemoryPacksCache();
    const fullFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/graphql')) return jsonResponse(404, { message: 'Not Found' });
      if (url.includes('/orgs/dripnex/repos')) {
        return jsonResponse(200, [packedRepo('theme-limestone'), packedRepo('theme-walnut')]);
      }
      if (url.includes('/repos/dripnex/theme-limestone/releases/latest')) {
        return packedRelease('theme-limestone');
      }
      if (url.includes('/repos/dripnex/theme-walnut/releases/latest')) {
        return packedRelease('theme-walnut');
      }
      return jsonResponse(404, { message: 'Not Found' });
    });

    const first = await discoverDripnexPacks({ fetchImpl: fullFetch, now: t0, cacheStore: shared });
    expect(first?.map(p => p.repoName).sort()).toEqual(['theme-limestone', 'theme-walnut']);

    resetGithubPacksCache();
    const limitedFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/graphql')) return jsonResponse(403, { message: 'rate limit' });
      if (url.includes('/orgs/dripnex/repos')) {
        return jsonResponse(200, [packedRepo('theme-limestone'), packedRepo('theme-walnut')]);
      }
      return jsonResponse(403, { message: 'API rate limit exceeded' });
    });

    const cold = await discoverDripnexPacks({
      fetchImpl: limitedFetch,
      now: t0 + GITHUB_PACKS_TTL_MS + 1,
      cacheStore: shared,
    });
    expect(cold?.map(p => p.repoName).sort()).toEqual(['theme-limestone', 'theme-walnut']);
  });

  it('discovers packed repos from one GraphQL query without REST releases/latest', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/graphql')) {
        return jsonResponse(200, {
          data: {
            organization: {
              repositories: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [
                  graphqlPackedNode('theme-limestone'),
                  graphqlPackedNode('theme-walnut'),
                  {
                    name: 'app',
                    url: 'https://github.com/dripnex/app',
                    isArchived: false,
                    latestRelease: null,
                  },
                ],
              },
            },
          },
        });
      }
      return jsonResponse(500, { message: 'REST should not run' });
    });

    const packs = await discoverDripnexPacks({ fetchImpl, now: 3, cacheStore: null });
    expect(packs?.map(p => p.repoName).sort()).toEqual(['theme-limestone', 'theme-walnut']);
    expect(fetchImpl.mock.calls.some(c => String(c[0]).includes('/releases/latest'))).toBe(false);
    expect(packs?.find(p => p.repoName === 'theme-limestone')?.bundleUrl).toContain(
      'theme-limestone-0.1.0.tar.gz'
    );
  });

  it('returns null on a rate-limited first scan so the seed catalog is used', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/orgs/dripnex/repos')) {
        return jsonResponse(200, [packedRepo('theme-alpha'), packedRepo('theme-beta')]);
      }
      if (url.includes('/repos/dripnex/theme-alpha/releases/latest')) {
        return packedRelease('theme-alpha');
      }
      if (url.includes('/repos/dripnex/theme-beta/releases/latest')) {
        return jsonResponse(403, { message: 'API rate limit exceeded' });
      }
      return jsonResponse(404, { message: 'Not Found' });
    });

    const result = await discoverDripnexPacks({ fetchImpl, now: 1 });
    expect(result).toBeNull();
  });
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubGithub(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response> | null
): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const handled = await handler(url, init);
      if (handled) return handled;
      return jsonResponse(404, { message: 'Not Found' });
    })
  );
}

describe('plugin registry', () => {
  beforeAll(async () => {
    await initTestDb(env);
  });

  afterAll(() => {
    cleanupTestDb(env);
  });

  beforeEach(() => {
    resetGithubPacksCache();
    // GitHub down → static FIRST_PARTY_PACKAGES seed (deterministic, no network).
    stubGithub(() => jsonResponse(500, { message: 'unavailable' }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetGithubPacksCache();
  });

  it('lists first-party packages when the catalog is empty', async () => {
    const res = await app.request('/plugins', {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      plugins: Array<{ slug: string; bundleUrl: string; repositoryUrl: string | null }>;
    };
    expect(body.plugins.some(p => p.slug === 'stamp')).toBe(true);
    expect(body.plugins.find(p => p.slug === 'stamp')?.bundleUrl).toContain('plugin-stamp');
    expect(body.plugins.map(p => p.slug).sort()).toEqual(
      [
        'dripnex-vim-mode',
        'math',
        'mermaid',
        'stamp',
        'theme-dune',
        'theme-ember',
        'theme-fog',
        'theme-glass',
        'theme-gruvbox',
        'theme-harbor-dusk',
        'theme-ion',
        'theme-matcha',
        'theme-midnight',
        'theme-night',
        'theme-noir',
        'theme-parchment',
        'theme-phosphor',
        'theme-sakura',
        'theme-solarized-dark',
        'theme-solarized-light',
        'theme-wave',
      ].sort()
    );
    expect(body.plugins.find(p => p.slug === 'dripnex-vim-mode')?.repositoryUrl).toBe(
      'https://github.com/dripnex/plugin-vim'
    );
    expect(body.plugins.find(p => p.slug === 'theme-parchment')?.repositoryUrl).toBe(
      'https://github.com/dripnex/theme-parchment'
    );
    expect(body.plugins.find(p => p.slug === 'theme-parchment')?.bundleUrl).toContain(
      'theme-parchment-0.1.0.tar.gz'
    );
  });

  it('serves the same index on /packages', async () => {
    const res = await app.request('/packages?q=stamp', {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { plugins: Array<{ slug: string }> };
    expect(body.plugins.map(p => p.slug)).toContain('stamp');
  });

  it('returns vim by manifest id from the first-party fallback', async () => {
    const res = await app.request('/plugins/dripnex-vim-mode', {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { slug: string; bundleUrl: string; repositoryUrl: string };
    expect(body.slug).toBe('dripnex-vim-mode');
    expect(body.repositoryUrl).toBe('https://github.com/dripnex/plugin-vim');
    expect(body.bundleUrl).toContain('dripnex-vim-mode-1.2.0.tar.gz');
  });

  it.each([
    'theme-parchment',
    'theme-harbor-dusk',
    'theme-wave',
    'theme-night',
    'theme-solarized-dark',
    'theme-solarized-light',
    'theme-gruvbox',
    'theme-glass',
    'theme-midnight',
    'theme-ember',
    'theme-ion',
    'theme-matcha',
    'theme-phosphor',
    'theme-fog',
    'theme-dune',
    'theme-noir',
    'theme-sakura',
  ] as const)('returns %s by slug from the first-party fallback', async slug => {
    const res = await app.request(`/plugins/${slug}`, {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      slug: string;
      category: string;
      bundleUrl: string;
      repositoryUrl: string;
    };
    expect(body.slug).toBe(slug);
    expect(body.category).toBe('theme');
    expect(body.repositoryUrl).toBe(`https://github.com/dripnex/${slug}`);
    expect(body.bundleUrl).toContain(
      `dripnex/${slug}/releases/download/v0.1.0/${slug}-0.1.0.tar.gz`
    );
  });

  it('returns stamp by slug from the first-party fallback', async () => {
    const res = await app.request('/plugins/stamp', {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { slug: string; bundleUrl: string };
    expect(body.slug).toBe('stamp');
    expect(body.bundleUrl).toContain('.tar.gz');
  });

  it('rejects publish without a token', async () => {
    const res = await app.request('/plugins', { method: 'POST', body: '{}' }, env);
    expect(res.status).toBe(401);
  });

  it('publishes a package and lists it', async () => {
    const userId = randomUUID();
    await seedFreeUser(env, userId, 'dev@dripnex.app');
    const token = await createAccessToken(userId, 'dev@dripnex.app');

    const res = await app.request(
      '/plugins',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          slug: 'hello-notes',
          name: 'Hello Notes',
          description: 'Says hello',
          version: '1.0.0',
          bundleUrl:
            'https://github.com/acme/hello-notes/releases/download/v1.0.0/hello-notes-1.0.0.tar.gz',
          repositoryUrl: 'https://github.com/acme/hello-notes',
          tags: ['demo'],
        }),
      },
      env
    );
    expect(res.status).toBe(201);
    const created = (await res.json()) as { slug: string; created: boolean };
    expect(created.slug).toBe('hello-notes');
    expect(created.created).toBe(true);

    const listed = await app.request('/plugins/hello-notes', {}, env);
    expect(listed.status).toBe(200);
    const detail = (await listed.json()) as { name: string; version: string; author: string };
    expect(detail.name).toBe('Hello Notes');
    expect(detail.version).toBe('1.0.0');
    expect(detail.author).toBe('dev@dripnex.app');
  });

  it('does not let another user claim the same slug', async () => {
    const userId = randomUUID();
    await seedFreeUser(env, userId, 'other@dripnex.app');
    const token = await createAccessToken(userId, 'other@dripnex.app');

    const res = await app.request(
      '/plugins',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({
          slug: 'hello-notes',
          name: 'Hijack',
          version: '9.9.9',
          bundleUrl: 'https://github.com/evil/x/releases/download/v9.9.9/x-9.9.9.tar.gz',
        }),
      },
      env
    );
    expect(res.status).toBe(403);
  });

  it('lists a satellite theme that only has a Release tarball, skips repos without assets', async () => {
    stubGithub(url => {
      if (url.includes('/orgs/dripnex/repos')) {
        return jsonResponse(200, [
          {
            name: 'app',
            html_url: 'https://github.com/dripnex/app',
            description: 'desktop app',
            default_branch: 'develop',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            archived: false,
            fork: false,
            private: false,
          },
          {
            name: 'theme-newpack',
            html_url: 'https://github.com/dripnex/theme-newpack',
            description: 'A new satellite theme.',
            default_branch: 'main',
            created_at: '2026-08-24T00:00:00.000Z',
            updated_at: '2026-08-24T00:00:00.000Z',
            archived: false,
            fork: false,
            private: false,
          },
          {
            name: 'theme-noasset',
            html_url: 'https://github.com/dripnex/theme-noasset',
            description: 'Tagged but no packed asset.',
            default_branch: 'main',
            created_at: '2026-08-24T00:00:00.000Z',
            updated_at: '2026-08-24T00:00:00.000Z',
            archived: false,
            fork: false,
            private: false,
          },
          {
            name: 'plugin-vim',
            html_url: 'https://github.com/dripnex/plugin-vim',
            description: 'Vim mode',
            default_branch: 'main',
            created_at: '2026-08-20T17:36:18.000Z',
            updated_at: '2026-08-20T17:36:18.000Z',
            archived: false,
            fork: false,
            private: false,
          },
          {
            name: 'theme-parchment',
            html_url: 'https://github.com/dripnex/theme-parchment',
            description: 'Warm paper palette',
            default_branch: 'main',
            created_at: '2026-08-18T00:00:00.000Z',
            updated_at: '2026-08-18T00:00:00.000Z',
            archived: false,
            fork: false,
            private: false,
          },
        ]);
      }
      if (url.includes('/repos/dripnex/theme-newpack/releases/latest')) {
        return jsonResponse(200, {
          tag_name: 'v0.1.0',
          published_at: '2026-08-24T12:00:00.000Z',
          tarball_url: 'https://api.github.com/repos/dripnex/theme-newpack/tarball/v0.1.0',
          assets: [
            {
              name: 'theme-newpack-0.1.0.tar.gz',
              browser_download_url:
                'https://github.com/dripnex/theme-newpack/releases/download/v0.1.0/theme-newpack-0.1.0.tar.gz',
            },
          ],
        });
      }
      if (url.includes('/repos/dripnex/theme-noasset/releases/latest')) {
        return jsonResponse(200, {
          tag_name: 'v0.1.0',
          published_at: '2026-08-24T12:00:00.000Z',
          tarball_url: 'https://api.github.com/repos/dripnex/theme-noasset/tarball/v0.1.0',
          assets: [],
        });
      }
      if (url.includes('/repos/dripnex/plugin-vim/releases/latest')) {
        return jsonResponse(200, {
          tag_name: 'v1.2.0',
          published_at: '2026-08-20T17:36:18.000Z',
          assets: [
            {
              name: 'dripnex-vim-mode-1.2.0.tar.gz',
              browser_download_url:
                'https://github.com/dripnex/plugin-vim/releases/download/v1.2.0/dripnex-vim-mode-1.2.0.tar.gz',
            },
          ],
        });
      }
      if (url.includes('/repos/dripnex/theme-parchment/releases/latest')) {
        return jsonResponse(200, {
          tag_name: 'v0.1.0',
          published_at: '2026-08-18T00:00:00.000Z',
          assets: [
            {
              name: 'theme-parchment-0.1.0.tar.gz',
              browser_download_url:
                'https://github.com/dripnex/theme-parchment/releases/download/v0.1.0/theme-parchment-0.1.0.tar.gz',
            },
          ],
        });
      }
      if (url.includes('/repos/dripnex/app/releases/latest')) {
        return jsonResponse(500, { message: 'should not fetch' });
      }
      return null;
    });

    const res = await app.request('/plugins', {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      plugins: Array<{
        slug: string;
        category: string;
        bundleUrl: string | null;
        repositoryUrl: string | null;
      }>;
    };
    const slugs = body.plugins.map(p => p.slug);

    expect(slugs).toContain('theme-newpack');
    expect(slugs).not.toContain('theme-noasset');
    expect(slugs).not.toContain('app');
    expect(slugs).toEqual(
      expect.arrayContaining(['dripnex-vim-mode', 'math', 'mermaid', 'stamp', 'theme-parchment'])
    );

    const satellite = body.plugins.find(p => p.slug === 'theme-newpack');
    expect(satellite?.category).toBe('theme');
    expect(satellite?.repositoryUrl).toBe('https://github.com/dripnex/theme-newpack');
    expect(satellite?.bundleUrl).toBe(
      'https://github.com/dripnex/theme-newpack/releases/download/v0.1.0/theme-newpack-0.1.0.tar.gz'
    );
    expect(satellite?.bundleUrl).not.toContain('/tarball/');

    const vim = body.plugins.find(p => p.slug === 'dripnex-vim-mode');
    expect(vim?.repositoryUrl).toBe('https://github.com/dripnex/plugin-vim');
    expect(vim?.bundleUrl).toContain('dripnex-vim-mode-1.2.0.tar.gz');

    const parchment = body.plugins.find(p => p.slug === 'theme-parchment');
    expect(parchment?.bundleUrl).toContain(
      'theme-parchment/releases/download/v0.1.0/theme-parchment-0.1.0.tar.gz'
    );

    const fetched = vi.mocked(globalThis.fetch).mock.calls.map(c => String(c[0]));
    expect(fetched.some(u => u.includes('/repos/dripnex/app/'))).toBe(false);
    expect(fetched.some(u => u.includes('/orgs/dripnex/repos'))).toBe(true);

    const detail = await app.request('/plugins/theme-newpack', {}, env);
    expect(detail.status).toBe(200);
    const detailBody = (await detail.json()) as { slug: string; bundleUrl: string };
    expect(detailBody.slug).toBe('theme-newpack');
    expect(detailBody.bundleUrl).toContain('theme-newpack-0.1.0.tar.gz');

    const missing = await app.request('/plugins/theme-noasset', {}, env);
    expect(missing.status).toBe(404);
  });

  it('sends GITHUB_TOKEN when present and still works unauthenticated', async () => {
    const authed = { ...env, GITHUB_TOKEN: 'test-github-token' };
    let authorization: string | null = null;
    stubGithub((url, init) => {
      if (url.includes('/orgs/dripnex/repos')) {
        authorization = new Headers(init?.headers).get('Authorization');
        return jsonResponse(200, []);
      }
      return null;
    });
    const res = await app.request('/plugins', {}, authed);
    expect(res.status).toBe(200);
    expect(authorization).toBe('Bearer test-github-token');
    const body = (await res.json()) as { plugins: Array<{ slug: string }> };
    expect(body.plugins.map(p => p.slug)).toContain('dripnex-vim-mode');
  });

  it('falls back to seed including noir/sakura when a first scan is rate-limited', async () => {
    stubGithub(url => {
      if (url.includes('/orgs/dripnex/repos')) {
        return jsonResponse(200, [
          packedRepo('theme-dune'),
          packedRepo('theme-noir'),
          packedRepo('theme-sakura'),
        ]);
      }
      if (url.includes('/repos/dripnex/theme-dune/releases/latest')) {
        return packedRelease('theme-dune');
      }
      if (url.includes('/repos/dripnex/theme-noir/releases/latest')) {
        return jsonResponse(403, { message: 'API rate limit exceeded' });
      }
      if (url.includes('/repos/dripnex/theme-sakura/releases/latest')) {
        return packedRelease('theme-sakura');
      }
      return null;
    });

    const res = await app.request('/plugins', {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { plugins: Array<{ slug: string }> };
    const slugs = body.plugins.map(p => p.slug);
    expect(slugs).toEqual(expect.arrayContaining(['theme-dune', 'theme-noir', 'theme-sakura']));
    expect(slugs).toContain('dripnex-vim-mode');
  });

  it('lists live extras such as limestone from a GraphQL scan, not only the seed', async () => {
    stubGithub(url => {
      if (url.includes('/graphql')) {
        return jsonResponse(200, {
          data: {
            organization: {
              repositories: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [
                  graphqlPackedNode('theme-limestone'),
                  graphqlPackedNode('theme-walnut'),
                  graphqlPackedNode('theme-ash'),
                  graphqlPackedNode('theme-parchment'),
                  graphqlPackedNode('plugin-vim'),
                ],
              },
            },
          },
        });
      }
      return null;
    });

    const res = await app.request('/plugins', {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    const body = (await res.json()) as { plugins: Array<{ slug: string }>; total: number };
    const slugs = body.plugins.map(p => p.slug);
    expect(slugs).toEqual(
      expect.arrayContaining(['theme-limestone', 'theme-walnut', 'theme-ash', 'theme-parchment'])
    );
    expect(slugs).toContain('dripnex-vim-mode');
    expect(body.total).toBeGreaterThanOrEqual(5);
  });
});
