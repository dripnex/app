/**
 * Tests for GET /sync/status
 * — sync status endpoint returning plan, cursor, and change counts
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /sync/status', () => {
  const { env } = createTestEnv();

  beforeAll(async () => {
    await initTestDb(env);
  });

  afterAll(() => {
    cleanupTestDb(env);
  });

  it('returns enabled=false for free user', async () => {
    const userId = randomUUID();
    await seedFreeUser(env, userId, `free-status-${userId}@test.com`);
    const token = await createAccessToken(userId, `free-status-${userId}@test.com`);

    const res = await app.request('/sync/status', { headers: authHeader(token) }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      enabled: false,
      plan: 'free',
      cursor: 0,
      totalChanges: 0,
    });
  });

  it('returns enabled=true for pro user', async () => {
    const userId = randomUUID();
    await seedProUser(env, userId, `pro-status-${userId}@test.com`);
    const token = await createAccessToken(userId, `pro-status-${userId}@test.com`);

    const res = await app.request('/sync/status', { headers: authHeader(token) }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      enabled: true,
      plan: 'pro',
      cursor: 0,
      totalChanges: 0,
    });
  });

  it('returns correct cursor after pull', async () => {
    const userId = randomUUID();
    const deviceId = randomUUID();
    await seedProUser(env, userId, `pro-status-cursor-${userId}@test.com`);
    const token = await createAccessToken(userId, `pro-status-cursor-${userId}@test.com`, deviceId);

    // Seed some sync log entries
    await seedSyncLog(env, userId, [
      { noteId: randomUUID(), version: 1, operation: 'create', encryptedData: 'enc1', deviceId },
      { noteId: randomUUID(), version: 2, operation: 'create', encryptedData: 'enc2', deviceId },
    ]);

    // Do a GET /sync to update the cursor
    const pullRes = await app.request('/sync?cursor=0', { headers: authHeader(token) }, env);
    expect(pullRes.status).toBe(200);
    const pullBody = await pullRes.json();
    expect(pullBody.cursor).toBe(2);

    // Now check status — cursor should match
    const res = await app.request('/sync/status', { headers: authHeader(token) }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cursor).toBe(2);
    expect(body.enabled).toBe(true);
  });

  it('returns correct totalChanges count', async () => {
    const userId = randomUUID();
    const deviceId = randomUUID();
    await seedProUser(env, userId, `pro-status-count-${userId}@test.com`);
    const token = await createAccessToken(userId, `pro-status-count-${userId}@test.com`, deviceId);

    // Seed 3 sync log entries
    await seedSyncLog(env, userId, [
      { noteId: randomUUID(), version: 1, operation: 'create', encryptedData: 'enc1', deviceId },
      { noteId: randomUUID(), version: 2, operation: 'create', encryptedData: 'enc2', deviceId },
      { noteId: randomUUID(), version: 3, operation: 'update', encryptedData: 'enc3', deviceId },
    ]);

    const res = await app.request('/sync/status', { headers: authHeader(token) }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalChanges).toBe(3);
  });
});
