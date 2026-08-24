import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import app from '../src/index.js';
import {
  fallbackSlug,
  isFirstPartyRepoName,
  pickPackedTarball,
  resetGithubPacksCache,
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
        'theme-ember',
        'theme-fog',
        'theme-glass',
        'theme-gruvbox',
        'theme-harbor-dusk',
        'theme-ion',
        'theme-matcha',
        'theme-midnight',
        'theme-night',
        'theme-parchment',
        'theme-phosphor',
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
});
