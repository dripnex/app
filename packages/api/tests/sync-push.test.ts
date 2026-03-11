/**
 * Tests for POST /sync — note sync push endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /sync — push changes', () => {
  const { env } = createTestEnv();

  // Shared pro user for most tests
  const proUserId = randomUUID();
  const proEmail = `pro-push-${proUserId}@test.com`;
  const deviceA = randomUUID();
  const deviceB = randomUUID();
  let proToken: string;

  beforeAll(async () => {
    await initTestDb(env);
    await seedProUser(env, proUserId, proEmail);
    proToken = await createAccessToken(proUserId, proEmail, deviceA);
  });

  afterAll(() => {
    cleanupTestDb(env);
  });

  // Helper to push changes
  async function pushChanges(
    token: string,
    changes: Array<{
      noteId: string;
      operation: string;
      encryptedData?: string | null;
      localVersion?: number;
    }>,
    deviceId: string
  ) {
    return app.request(
      '/sync',
      {
        method: 'POST',
        headers: {
          ...authHeader(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ changes, deviceId }),
      },
      env
    );
  }

  it('returns 403 for free user', async () => {
    const freeUserId = randomUUID();
    await seedFreeUser(env, freeUserId, `free-push-${freeUserId}@test.com`);
    const freeToken = await createAccessToken(
      freeUserId,
      `free-push-${freeUserId}@test.com`,
      deviceA
    );

    const res = await pushChanges(
      freeToken,
      [{ noteId: randomUUID(), operation: 'create', encryptedData: 'enc' }],
      deviceA
    );
    expect(res.status).toBe(403);
  });

  it('applies a single change and returns version', async () => {
    const noteId = randomUUID();

    const res = await pushChanges(
      proToken,
      [{ noteId, operation: 'create', encryptedData: 'encrypted-content' }],
      deviceA
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toEqual({
      noteId,
      version: expect.any(Number),
      status: 'applied',
    });
    expect(body.results[0].version).toBeGreaterThanOrEqual(1);
  });

  it('applies multiple changes with sequential versions', async () => {
    // Use a fresh pro user to get predictable version numbers starting at 1
    const userId = randomUUID();
    const email = `pro-multi-${userId}@test.com`;
    await seedProUser(env, userId, email);
    const token = await createAccessToken(userId, email, deviceA);

    const noteIds = [randomUUID(), randomUUID(), randomUUID()];

    const res = await pushChanges(
      token,
      noteIds.map((id) => ({
        noteId: id,
        operation: 'create',
        encryptedData: `data-${id}`,
      })),
      deviceA
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.results).toHaveLength(3);
    expect(body.results[0].version).toBe(1);
    expect(body.results[1].version).toBe(2);
    expect(body.results[2].version).toBe(3);
    expect(body.results.every((r: { status: string }) => r.status === 'applied')).toBe(true);
  });

  it('detects conflict when another device has newer version', async () => {
    // Fresh user for isolation
    const userId = randomUUID();
    const email = `pro-conflict-${userId}@test.com`;
    await seedProUser(env, userId, email);
    const tokenA = await createAccessToken(userId, email, deviceA);
    const tokenB = await createAccessToken(userId, email, deviceB);

    const noteId = randomUUID();

    // Device A pushes note "x" — gets version 1
    const resA = await pushChanges(
      tokenA,
      [{ noteId, operation: 'create', encryptedData: 'from-device-a' }],
      deviceA
    );
    expect(resA.status).toBe(200);
    const bodyA = await resA.json();
    expect(bodyA.results[0].status).toBe('applied');
    expect(bodyA.results[0].version).toBe(1);

    // Device B pushes same note with localVersion=0 → conflict
    const resB = await pushChanges(
      tokenB,
      [{ noteId, operation: 'update', encryptedData: 'from-device-b', localVersion: 0 }],
      deviceB
    );
    expect(resB.status).toBe(200);
    const bodyB = await resB.json();
    expect(bodyB.results[0].status).toBe('conflict');
    expect(bodyB.results[0].serverVersion).toBe(1);
  });

  it('no conflict when same device pushes again', async () => {
    // Fresh user for isolation
    const userId = randomUUID();
    const email = `pro-samedev-${userId}@test.com`;
    await seedProUser(env, userId, email);
    const token = await createAccessToken(userId, email, deviceA);

    const noteId = randomUUID();

    // Device A pushes note — gets version 1
    const res1 = await pushChanges(
      token,
      [{ noteId, operation: 'create', encryptedData: 'v1' }],
      deviceA
    );
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.results[0].version).toBe(1);

    // Same device pushes again with localVersion=1 → should be applied (not conflict)
    const res2 = await pushChanges(
      token,
      [{ noteId, operation: 'update', encryptedData: 'v2', localVersion: 1 }],
      deviceA
    );
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.results[0].status).toBe('applied');
    expect(body2.results[0].version).toBe(2);
  });

  it('applies change when no localVersion provided (first push)', async () => {
    // Fresh user for isolation
    const userId = randomUUID();
    const email = `pro-nolv-${userId}@test.com`;
    await seedProUser(env, userId, email);
    const tokenA = await createAccessToken(userId, email, deviceA);
    const tokenB = await createAccessToken(userId, email, deviceB);

    const noteId = randomUUID();

    // Device A pushes note
    await pushChanges(
      tokenA,
      [{ noteId, operation: 'create', encryptedData: 'data-a' }],
      deviceA
    );

    // Device B pushes same note WITHOUT localVersion → always applied
    const res = await pushChanges(
      tokenB,
      [{ noteId, operation: 'update', encryptedData: 'data-b' }],
      deviceB
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].status).toBe('applied');
  });

  it('validates schema - rejects empty changes array', async () => {
    const res = await app.request(
      '/sync',
      {
        method: 'POST',
        headers: {
          ...authHeader(proToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ changes: [], deviceId: deviceA }),
      },
      env
    );
    expect(res.status).toBe(400);
  });

  it('returns cursor equal to last assigned version', async () => {
    // Fresh user for isolation
    const userId = randomUUID();
    const email = `pro-cursor-${userId}@test.com`;
    await seedProUser(env, userId, email);
    const token = await createAccessToken(userId, email, deviceA);

    const noteIds = [randomUUID(), randomUUID(), randomUUID()];

    const res = await pushChanges(
      token,
      noteIds.map((id) => ({
        noteId: id,
        operation: 'create',
        encryptedData: `data-${id}`,
      })),
      deviceA
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.cursor).toBe(3);
    expect(body.results[2].version).toBe(body.cursor);
  });
});
