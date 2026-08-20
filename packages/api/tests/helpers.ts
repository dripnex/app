/**
 * Test Helpers for Dripnex API
 *
 * Provides utilities for testing Hono routes against
 * an in-memory SQLite database via libSQL.
 */

import { randomUUID } from 'node:crypto';
import { unlinkSync } from 'node:fs';
import { createClient } from '@libsql/client';
import * as jose from 'jose';
import type { Env } from '../src/db/client.js';
import { applyMigrations } from '../src/db/runMigrations.js';

const TEST_JWT_SECRET = 'test-jwt-secret-for-dripnex-api-tests';

/**
 * Create a test environment with a unique temp SQLite file.
 * Each test suite gets its own DB; calls within the suite share it.
 */
export function createTestEnv(): { env: Env } {
  const dbPath = `/tmp/dripnex-test-${randomUUID()}.db`;
  return {
    env: {
      TURSO_DATABASE_URL: `file:${dbPath}`,
      TURSO_AUTH_TOKEN: '',
      JWT_SECRET: TEST_JWT_SECRET,
      ENVIRONMENT: 'test',
    },
  };
}

/**
 * Initialize the test database with the same journal the Worker applies.
 */
export async function initTestDb(env: Env): Promise<void> {
  const client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN || undefined,
  });
  await applyMigrations(client);
}

/**
 * Delete the temp DB file. Call in afterAll.
 */
export function cleanupTestDb(env: Env): void {
  const filePath = env.TURSO_DATABASE_URL.replace('file:', '');
  try {
    unlinkSync(filePath);
  } catch {
    // File may not exist if tests failed early — that's fine
  }
}

/**
 * Seed a user with an active Pro subscription.
 */
export async function seedProUser(env: Env, userId: string, email: string): Promise<void> {
  const client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN || undefined,
  });
  const now = new Date().toISOString();

  await client.execute({
    sql: 'INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)',
    args: [userId, email, now, now],
  });

  await client.execute({
    sql: `INSERT INTO subscriptions (id, user_id, status, plan, created_at, updated_at)
          VALUES (?, ?, 'active', 'pro', ?, ?)`,
    args: [randomUUID(), userId, now, now],
  });
}

/**
 * Seed a user without a subscription (free tier).
 */
export async function seedFreeUser(env: Env, userId: string, email: string): Promise<void> {
  const client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN || undefined,
  });
  const now = new Date().toISOString();

  await client.execute({
    sql: 'INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)',
    args: [userId, email, now, now],
  });
}

/**
 * Create a valid access JWT (HS256, 15min expiry).
 * Matches the format expected by src/middleware/auth.ts.
 */
export async function createAccessToken(
  userId: string,
  email: string,
  deviceId?: string
): Promise<string> {
  const secret = new TextEncoder().encode(TEST_JWT_SECRET);

  const builder = new jose.SignJWT({
    email,
    deviceId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('15m');

  return builder.sign(secret);
}

/**
 * Returns an Authorization header object for use with app.request().
 */
export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
