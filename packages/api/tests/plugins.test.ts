import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';
import {
  createTestEnv,
  initTestDb,
  cleanupTestDb,
  seedFreeUser,
  createAccessToken,
  authHeader,
} from './helpers.js';

const { env } = createTestEnv();

describe('plugin registry', () => {
  beforeAll(async () => {
    await initTestDb(env);
  });

  afterAll(() => {
    cleanupTestDb(env);
  });

  it('lists first-party packages when the catalog is empty', async () => {
    const res = await app.request('/plugins', {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { plugins: Array<{ slug: string; bundleUrl: string }> };
    expect(body.plugins.some(p => p.slug === 'stamp')).toBe(true);
    expect(body.plugins.find(p => p.slug === 'stamp')?.bundleUrl).toContain('plugin-stamp');
    expect(body.plugins.map(p => p.slug).sort()).toEqual(
      ['dripnex-vim-mode', 'math', 'mermaid', 'stamp', 'theme-parchment'].sort()
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
});
