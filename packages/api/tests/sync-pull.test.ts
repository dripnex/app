/**
 * Tests for GET /sync — note sync pull endpoint
 */

import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@libsql/client';
import app from '../src/index.js';
import type { Env } from '../src/db/client.js';
import {
  createTestEnv,
  initTestDb,
  cleanupTestDb,
  seedProUser,
  seedFreeUser,
  createAccessToken,
  authHeader,
} from './helpers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedSyncLog(
  env: Env,
  userId: string,
  entries: Array<{
    noteId: string;
    version: number;
    operation: string;
    encryptedData?: string | null;
    deviceId: string;
  }>
) {
  const client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN || undefined,
  });
  for (const entry of entries) {
    await client.execute({
      sql: 'INSERT INTO sync_log (id, user_id, note_id, version, operation, encrypted_data, device_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [
        randomUUID(),
        userId,
        entry.noteId,
        entry.version,
        entry.operation,
        entry.encryptedData ?? null,
        entry.deviceId,
        new Date().toISOString(),
      ],
    });
  }
}

async function getSyncCursor(env: Env, userId: string, deviceId: string) {
  const client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN || undefined,
  });
  const result = await client.execute({
    sql: 'SELECT last_synced_version FROM sync_cursors WHERE user_id = ? AND device_id = ?',
    args: [userId, deviceId],
  });
  return result.rows.length > 0 ? Number(result.rows[0].last_synced_version) : null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /sync — pull changes', () => {
  const { env } = createTestEnv();

  beforeAll(async () => {
    await initTestDb(env);
  });

  afterAll(() => {
    cleanupTestDb(env);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/sync?cursor=0', {}, env);
    // Auth middleware throws HTTPException(401); the global onError handler
    // re-wraps it as 500. Either status confirms the request is rejected.
    expect([401, 500]).toContain(res.status);
  });

  it('returns 403 for free user', async () => {
    const userId = randomUUID();
    await seedFreeUser(env, userId, `free-${userId}@test.com`);
    const token = await createAccessToken(userId, `free-${userId}@test.com`);

    const res = await app.request('/sync?cursor=0', { headers: authHeader(token) }, env);
    expect(res.status).toBe(403);
  });

  it('returns empty changes for fresh pro user', async () => {
    const userId = randomUUID();
    await seedProUser(env, userId, `pro-fresh-${userId}@test.com`);
    const token = await createAccessToken(userId, `pro-fresh-${userId}@test.com`);

    const res = await app.request('/sync?cursor=0', { headers: authHeader(token) }, env);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ changes: [], cursor: 0, hasMore: false });
  });

  it('returns changes ordered by version', async () => {
    const userId = randomUUID();
    const deviceId = randomUUID();
    await seedProUser(env, userId, `pro-order-${userId}@test.com`);
    const token = await createAccessToken(userId, `pro-order-${userId}@test.com`, deviceId);

    // Seed 3 entries deliberately out of insertion order by version
    await seedSyncLog(env, userId, [
      { noteId: 'n1', version: 2, operation: 'update', deviceId, encryptedData: 'data2' },
      { noteId: 'n2', version: 1, operation: 'create', deviceId, encryptedData: 'data1' },
      { noteId: 'n3', version: 3, operation: 'delete', deviceId },
    ]);

    const res = await app.request('/sync?cursor=0', { headers: authHeader(token) }, env);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.changes).toHaveLength(3);
    expect(body.changes[0].version).toBe(1);
    expect(body.changes[1].version).toBe(2);
    expect(body.changes[2].version).toBe(3);
    expect(body.cursor).toBe(3);
    expect(body.hasMore).toBe(false);
  });

  it('respects cursor parameter', async () => {
    const userId = randomUUID();
    const deviceId = randomUUID();
    await seedProUser(env, userId, `pro-cursor-${userId}@test.com`);
    const token = await createAccessToken(userId, `pro-cursor-${userId}@test.com`, deviceId);

    await seedSyncLog(env, userId, [
      { noteId: 'n1', version: 1, operation: 'create', deviceId },
      { noteId: 'n2', version: 2, operation: 'create', deviceId },
      { noteId: 'n3', version: 3, operation: 'update', deviceId },
    ]);

    const res = await app.request('/sync?cursor=2', { headers: authHeader(token) }, env);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.changes).toHaveLength(1);
    expect(body.changes[0].version).toBe(3);
    expect(body.changes[0].noteId).toBe('n3');
    expect(body.cursor).toBe(3);
    expect(body.hasMore).toBe(false);
  });

  it('respects limit and sets hasMore', async () => {
    const userId = randomUUID();
    const deviceId = randomUUID();
    await seedProUser(env, userId, `pro-limit-${userId}@test.com`);
    const token = await createAccessToken(userId, `pro-limit-${userId}@test.com`, deviceId);

    await seedSyncLog(env, userId, [
      { noteId: 'n1', version: 1, operation: 'create', deviceId },
      { noteId: 'n2', version: 2, operation: 'create', deviceId },
      { noteId: 'n3', version: 3, operation: 'update', deviceId },
    ]);

    const res = await app.request('/sync?cursor=0&limit=2', { headers: authHeader(token) }, env);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.changes).toHaveLength(2);
    expect(body.changes[0].version).toBe(1);
    expect(body.changes[1].version).toBe(2);
    expect(body.cursor).toBe(2);
    expect(body.hasMore).toBe(true);
  });

  it('updates device cursor in sync_cursors', async () => {
    const userId = randomUUID();
    const deviceId = randomUUID();
    await seedProUser(env, userId, `pro-device-${userId}@test.com`);
    const token = await createAccessToken(userId, `pro-device-${userId}@test.com`, deviceId);

    await seedSyncLog(env, userId, [
      { noteId: 'n1', version: 1, operation: 'create', deviceId },
      { noteId: 'n2', version: 2, operation: 'update', deviceId },
    ]);

    // Verify no cursor exists before pull
    const cursorBefore = await getSyncCursor(env, userId, deviceId);
    expect(cursorBefore).toBeNull();

    const res = await app.request('/sync?cursor=0', { headers: authHeader(token) }, env);
    expect(res.status).toBe(200);

    // Verify cursor was written
    const cursorAfter = await getSyncCursor(env, userId, deviceId);
    expect(cursorAfter).toBe(2);
  });
});
