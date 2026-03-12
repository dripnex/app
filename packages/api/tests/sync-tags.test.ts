/**
 * Tests for GET /sync/tags and POST /sync/tags
 * — tag sync pull/push with validation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@libsql/client';
import { randomUUID } from 'node:crypto';
import app from '../src/index.js';
import {
  createTestEnv,
  initTestDb,
  cleanupTestDb,
  seedProUser,
  seedFreeUser,
  createAccessToken,
  authHeader,
} from './helpers.js';
import type { Env } from '../src/db/client.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedTagSyncLog(
  env: Env,
  userId: string,
  entries: Array<{
    tagId: string;
    version: number;
    operation: string;
    data?: string | null;
    deviceId: string;
  }>
) {
  const client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN || undefined,
  });
  for (const entry of entries) {
    await client.execute({
      sql: 'INSERT INTO tag_sync_log (id, user_id, tag_id, version, operation, data, device_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [
        randomUUID(),
        userId,
        entry.tagId,
        entry.version,
        entry.operation,
        entry.data ?? null,
        entry.deviceId,
        new Date().toISOString(),
      ],
    });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /sync/tags — pull tag changes', () => {
  const { env } = createTestEnv();

  beforeAll(async () => {
    await initTestDb(env);
  });

  afterAll(() => {
    cleanupTestDb(env);
  });

  it('returns 403 for free user', async () => {
    const userId = randomUUID();
    await seedFreeUser(env, userId, `free-tag-${userId}@test.com`);
    const token = await createAccessToken(userId, `free-tag-${userId}@test.com`);

    const res = await app.request('/sync/tags?cursor=0', { headers: authHeader(token) }, env);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Sync requires Pro subscription');
  });

  it('returns changes after cursor', async () => {
    const userId = randomUUID();
    const deviceId = randomUUID();
    await seedProUser(env, userId, `pro-tag-pull-${userId}@test.com`);
    const token = await createAccessToken(userId, `pro-tag-pull-${userId}@test.com`, deviceId);

    const tag1 = randomUUID();
    const tag2 = randomUUID();
    const tag3 = randomUUID();

    await seedTagSyncLog(env, userId, [
      {
        tagId: tag1,
        version: 1,
        operation: 'create',
        data: JSON.stringify({ name: 'javascript', color: '#f7df1e' }),
        deviceId,
      },
      {
        tagId: tag2,
        version: 2,
        operation: 'create',
        data: JSON.stringify({ name: 'typescript', color: '#3178c6' }),
        deviceId,
      },
      {
        tagId: tag3,
        version: 3,
        operation: 'create',
        data: JSON.stringify({ name: 'rust', color: '#dea584' }),
        deviceId,
      },
    ]);

    // Pull from cursor=0 — should get all 3
    const res = await app.request('/sync/tags?cursor=0', { headers: authHeader(token) }, env);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.changes).toHaveLength(3);
    expect(body.changes[0].version).toBe(1);
    expect(body.changes[1].version).toBe(2);
    expect(body.changes[2].version).toBe(3);
    expect(body.cursor).toBe(3);
    expect(body.hasMore).toBe(false);

    // Pull from cursor=2 — should get only version 3
    const res2 = await app.request('/sync/tags?cursor=2', { headers: authHeader(token) }, env);
    expect(res2.status).toBe(200);

    const body2 = await res2.json();
    expect(body2.changes).toHaveLength(1);
    expect(body2.changes[0].tagId).toBe(tag3);
    expect(body2.cursor).toBe(3);
  });
});

describe('POST /sync/tags — push tag changes', () => {
  const { env } = createTestEnv();

  beforeAll(async () => {
    await initTestDb(env);
  });

  afterAll(() => {
    cleanupTestDb(env);
  });

  it('applies tag changes with sequential versions', async () => {
    const userId = randomUUID();
    const deviceId = randomUUID();
    await seedProUser(env, userId, `pro-tag-push-${userId}@test.com`);
    const token = await createAccessToken(userId, `pro-tag-push-${userId}@test.com`, deviceId);

    const tag1 = randomUUID();
    const tag2 = randomUUID();

    const res = await app.request(
      '/sync/tags',
      {
        method: 'POST',
        headers: { ...authHeader(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: [
            {
              tagId: tag1,
              operation: 'create',
              data: JSON.stringify({ name: 'javascript', color: '#f7df1e' }),
              localVersion: 0,
            },
            {
              tagId: tag2,
              operation: 'create',
              data: JSON.stringify({ name: 'typescript', color: '#3178c6' }),
              localVersion: 0,
            },
          ],
          deviceId,
        }),
      },
      env
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(2);
    expect(body.results[0]).toEqual({ tagId: tag1, version: 1, status: 'applied' });
    expect(body.results[1]).toEqual({ tagId: tag2, version: 2, status: 'applied' });
    expect(body.cursor).toBe(2);
  });

  it('rejects invalid tag data (missing name)', async () => {
    const userId = randomUUID();
    const deviceId = randomUUID();
    await seedProUser(env, userId, `pro-tag-invalid-${userId}@test.com`);
    const token = await createAccessToken(userId, `pro-tag-invalid-${userId}@test.com`, deviceId);

    const tagId = randomUUID();

    const res = await app.request(
      '/sync/tags',
      {
        method: 'POST',
        headers: { ...authHeader(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: [
            {
              tagId,
              operation: 'create',
              data: '{"color":"red"}',
              localVersion: 0,
            },
          ],
          deviceId,
        }),
      },
      env
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('Tag data must include name');
  });

  it('detects conflicts between devices', async () => {
    const userId = randomUUID();
    const deviceA = randomUUID();
    const deviceB = randomUUID();
    await seedProUser(env, userId, `pro-tag-conflict-${userId}@test.com`);
    const tokenA = await createAccessToken(userId, `pro-tag-conflict-${userId}@test.com`, deviceA);
    const tokenB = await createAccessToken(userId, `pro-tag-conflict-${userId}@test.com`, deviceB);

    const tagId = randomUUID();

    // Device A creates a tag
    const res1 = await app.request(
      '/sync/tags',
      {
        method: 'POST',
        headers: { ...authHeader(tokenA), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: [
            {
              tagId,
              operation: 'create',
              data: JSON.stringify({ name: 'shared-tag', color: '#000' }),
              localVersion: 0,
            },
          ],
          deviceId: deviceA,
        }),
      },
      env
    );
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.results[0].status).toBe('applied');

    // Device B pushes same tag with stale localVersion=0
    const res2 = await app.request(
      '/sync/tags',
      {
        method: 'POST',
        headers: { ...authHeader(tokenB), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: [
            {
              tagId,
              operation: 'update',
              data: JSON.stringify({ name: 'shared-tag-renamed', color: '#fff' }),
              localVersion: 0,
            },
          ],
          deviceId: deviceB,
        }),
      },
      env
    );
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.results[0].status).toBe('conflict');
    expect(body2.results[0].serverVersion).toBe(1);
    expect(body2.results[0].tagId).toBe(tagId);
  });

  it('handles delete operations', async () => {
    const userId = randomUUID();
    const deviceId = randomUUID();
    await seedProUser(env, userId, `pro-tag-del-${userId}@test.com`);
    const token = await createAccessToken(userId, `pro-tag-del-${userId}@test.com`, deviceId);

    const tagId = randomUUID();

    // First create
    const res1 = await app.request(
      '/sync/tags',
      {
        method: 'POST',
        headers: { ...authHeader(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: [
            {
              tagId,
              operation: 'create',
              data: JSON.stringify({ name: 'temp-tag', color: '#abc' }),
              localVersion: 0,
            },
          ],
          deviceId,
        }),
      },
      env
    );
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.results[0].status).toBe('applied');

    // Then delete
    const res2 = await app.request(
      '/sync/tags',
      {
        method: 'POST',
        headers: { ...authHeader(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: [
            {
              tagId,
              operation: 'delete',
              localVersion: 1,
            },
          ],
          deviceId,
        }),
      },
      env
    );
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.results[0].status).toBe('applied');
    expect(body2.results[0].tagId).toBe(tagId);
  });
});
