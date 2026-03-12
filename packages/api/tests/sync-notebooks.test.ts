/**
 * Tests for GET /sync/notebooks and POST /sync/notebooks
 * — notebook sync pull/push with tree validation
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

async function seedNotebookSyncLog(
  env: Env,
  userId: string,
  entries: Array<{
    notebookId: string;
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
      sql: 'INSERT INTO notebook_sync_log (id, user_id, notebook_id, version, operation, data, device_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [
        randomUUID(),
        userId,
        entry.notebookId,
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

describe('GET /sync/notebooks — pull notebook changes', () => {
  const { env } = createTestEnv();

  beforeAll(async () => {
    await initTestDb(env);
  });

  afterAll(() => {
    cleanupTestDb(env);
  });

  it('returns 403 for free user', async () => {
    const userId = randomUUID();
    await seedFreeUser(env, userId, `free-nb-${userId}@test.com`);
    const token = await createAccessToken(userId, `free-nb-${userId}@test.com`);

    const res = await app.request('/sync/notebooks?cursor=0', { headers: authHeader(token) }, env);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Sync requires Pro subscription');
  });

  it('returns changes after cursor', async () => {
    const userId = randomUUID();
    const deviceId = randomUUID();
    await seedProUser(env, userId, `pro-nb-pull-${userId}@test.com`);
    const token = await createAccessToken(userId, `pro-nb-pull-${userId}@test.com`, deviceId);

    const nb1 = randomUUID();
    const nb2 = randomUUID();
    const nb3 = randomUUID();

    await seedNotebookSyncLog(env, userId, [
      {
        notebookId: nb1,
        version: 1,
        operation: 'create',
        data: JSON.stringify({ name: 'Notebook 1', parentId: null, depth: 0, order: 0 }),
        deviceId,
      },
      {
        notebookId: nb2,
        version: 2,
        operation: 'create',
        data: JSON.stringify({ name: 'Notebook 2', parentId: null, depth: 0, order: 1 }),
        deviceId,
      },
      {
        notebookId: nb3,
        version: 3,
        operation: 'create',
        data: JSON.stringify({ name: 'Notebook 3', parentId: null, depth: 0, order: 2 }),
        deviceId,
      },
    ]);

    // Pull from cursor=0 — should get all 3
    const res = await app.request('/sync/notebooks?cursor=0', { headers: authHeader(token) }, env);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.changes).toHaveLength(3);
    expect(body.changes[0].version).toBe(1);
    expect(body.changes[1].version).toBe(2);
    expect(body.changes[2].version).toBe(3);
    expect(body.cursor).toBe(3);
    expect(body.hasMore).toBe(false);

    // Pull from cursor=2 — should get only version 3
    const res2 = await app.request('/sync/notebooks?cursor=2', { headers: authHeader(token) }, env);
    expect(res2.status).toBe(200);

    const body2 = await res2.json();
    expect(body2.changes).toHaveLength(1);
    expect(body2.changes[0].notebookId).toBe(nb3);
    expect(body2.cursor).toBe(3);
  });
});

describe('POST /sync/notebooks — push notebook changes', () => {
  const { env } = createTestEnv();

  beforeAll(async () => {
    await initTestDb(env);
  });

  afterAll(() => {
    cleanupTestDb(env);
  });

  it('applies notebook changes with versions', async () => {
    const userId = randomUUID();
    const deviceId = randomUUID();
    await seedProUser(env, userId, `pro-nb-push-${userId}@test.com`);
    const token = await createAccessToken(userId, `pro-nb-push-${userId}@test.com`, deviceId);

    const nb1 = randomUUID();
    const nb2 = randomUUID();

    const res = await app.request(
      '/sync/notebooks',
      {
        method: 'POST',
        headers: { ...authHeader(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: [
            {
              notebookId: nb1,
              operation: 'create',
              data: JSON.stringify({ name: 'Work', parentId: null, depth: 0, order: 0 }),
              localVersion: 0,
            },
            {
              notebookId: nb2,
              operation: 'create',
              data: JSON.stringify({ name: 'Personal', parentId: null, depth: 0, order: 1 }),
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
    expect(body.results[0]).toEqual({ notebookId: nb1, version: 1, status: 'applied' });
    expect(body.results[1]).toEqual({ notebookId: nb2, version: 2, status: 'applied' });
    expect(body.cursor).toBe(2);
  });

  it('rejects depth > 2', async () => {
    const userId = randomUUID();
    const deviceId = randomUUID();
    await seedProUser(env, userId, `pro-nb-depth-${userId}@test.com`);
    const token = await createAccessToken(userId, `pro-nb-depth-${userId}@test.com`, deviceId);

    const nbId = randomUUID();

    const res = await app.request(
      '/sync/notebooks',
      {
        method: 'POST',
        headers: { ...authHeader(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: [
            {
              notebookId: nbId,
              operation: 'create',
              data: JSON.stringify({ name: 'Too Deep', parentId: null, depth: 3, order: 0 }),
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
    expect(body.error).toBe('Tree validation failed');
    expect(body.detail).toContain('depth exceeds max (2), got 3');
    expect(body.notebookId).toBe(nbId);
  });

  it('rejects missing parentId', async () => {
    const userId = randomUUID();
    const deviceId = randomUUID();
    await seedProUser(env, userId, `pro-nb-parent-${userId}@test.com`);
    const token = await createAccessToken(userId, `pro-nb-parent-${userId}@test.com`, deviceId);

    const nbId = randomUUID();
    const fakeParentId = randomUUID();

    const res = await app.request(
      '/sync/notebooks',
      {
        method: 'POST',
        headers: { ...authHeader(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: [
            {
              notebookId: nbId,
              operation: 'create',
              data: JSON.stringify({ name: 'Orphan', parentId: fakeParentId, depth: 1, order: 0 }),
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
    expect(body.error).toBe('Tree validation failed');
    expect(body.detail).toContain('not found');
    expect(body.notebookId).toBe(nbId);
  });

  it('rejects circular reference', async () => {
    const userId = randomUUID();
    const deviceId = randomUUID();
    await seedProUser(env, userId, `pro-nb-circ-${userId}@test.com`);
    const token = await createAccessToken(userId, `pro-nb-circ-${userId}@test.com`, deviceId);

    const nbA = randomUUID();
    const nbB = randomUUID();

    // First, create both notebooks as root-level (no parent)
    const setup = await app.request(
      '/sync/notebooks',
      {
        method: 'POST',
        headers: { ...authHeader(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: [
            {
              notebookId: nbA,
              operation: 'create',
              data: JSON.stringify({ name: 'A', parentId: null, depth: 0, order: 0 }),
              localVersion: 0,
            },
            {
              notebookId: nbB,
              operation: 'create',
              data: JSON.stringify({ name: 'B', parentId: null, depth: 0, order: 1 }),
              localVersion: 0,
            },
          ],
          deviceId,
        }),
      },
      env
    );
    expect(setup.status).toBe(200);

    // Now update both to point at each other, creating a cycle: A->B, B->A
    const res = await app.request(
      '/sync/notebooks',
      {
        method: 'POST',
        headers: { ...authHeader(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: [
            {
              notebookId: nbA,
              operation: 'update',
              data: JSON.stringify({ name: 'A', parentId: nbB, depth: 1, order: 0 }),
              localVersion: 1,
            },
            {
              notebookId: nbB,
              operation: 'update',
              data: JSON.stringify({ name: 'B', parentId: nbA, depth: 1, order: 1 }),
              localVersion: 2,
            },
          ],
          deviceId,
        }),
      },
      env
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('Tree validation failed');
    expect(body.detail).toContain('circular');
  });

  it('handles delete operations', async () => {
    const userId = randomUUID();
    const deviceId = randomUUID();
    await seedProUser(env, userId, `pro-nb-del-${userId}@test.com`);
    const token = await createAccessToken(userId, `pro-nb-del-${userId}@test.com`, deviceId);

    const nbId = randomUUID();

    // First create
    const res1 = await app.request(
      '/sync/notebooks',
      {
        method: 'POST',
        headers: { ...authHeader(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: [
            {
              notebookId: nbId,
              operation: 'create',
              data: JSON.stringify({ name: 'Temp', parentId: null, depth: 0, order: 0 }),
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
      '/sync/notebooks',
      {
        method: 'POST',
        headers: { ...authHeader(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: [
            {
              notebookId: nbId,
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
    expect(body2.results[0].notebookId).toBe(nbId);
  });

  it('detects conflicts between devices', async () => {
    const userId = randomUUID();
    const deviceA = randomUUID();
    const deviceB = randomUUID();
    await seedProUser(env, userId, `pro-nb-conflict-${userId}@test.com`);
    const tokenA = await createAccessToken(userId, `pro-nb-conflict-${userId}@test.com`, deviceA);
    const tokenB = await createAccessToken(userId, `pro-nb-conflict-${userId}@test.com`, deviceB);

    const nbId = randomUUID();

    // Device A creates a notebook
    const res1 = await app.request(
      '/sync/notebooks',
      {
        method: 'POST',
        headers: { ...authHeader(tokenA), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: [
            {
              notebookId: nbId,
              operation: 'create',
              data: JSON.stringify({ name: 'Shared', parentId: null, depth: 0, order: 0 }),
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

    // Device B pushes same notebook with localVersion=0 (stale)
    const res2 = await app.request(
      '/sync/notebooks',
      {
        method: 'POST',
        headers: { ...authHeader(tokenB), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: [
            {
              notebookId: nbId,
              operation: 'update',
              data: JSON.stringify({ name: 'Shared Renamed', parentId: null, depth: 0, order: 0 }),
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
    expect(body2.results[0].notebookId).toBe(nbId);
  });
});
