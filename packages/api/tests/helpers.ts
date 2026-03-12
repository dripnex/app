/**
 * Test Helpers for Readied API
 *
 * Provides utilities for testing Hono routes against
 * an in-memory SQLite database via libSQL.
 */

import { createClient } from '@libsql/client';
import * as jose from 'jose';
import { randomUUID } from 'node:crypto';
import { unlinkSync } from 'node:fs';
import type { Env } from '../src/db/client.js';

const TEST_JWT_SECRET = 'test-jwt-secret-for-readied-api-tests';

/**
 * Create a test environment with a unique temp SQLite file.
 * Each test suite gets its own DB; calls within the suite share it.
 */
export function createTestEnv(): { env: Env } {
  const dbPath = `/tmp/readied-test-${randomUUID()}.db`;
  return {
    env: {
      TURSO_DATABASE_URL: `file:${dbPath}`,
      TURSO_AUTH_TOKEN: '',
      JWT_SECRET: TEST_JWT_SECRET,
      ENVIRONMENT: 'test',
    },
  };
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, stripe_customer_id TEXT, stripe_subscription_id TEXT, status TEXT NOT NULL DEFAULT 'inactive', plan TEXT NOT NULL DEFAULT 'free', trial_ends_at TEXT, current_period_end TEXT, canceled_at TEXT, cancel_at_period_end INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sync_log (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, note_id TEXT NOT NULL, version INTEGER NOT NULL, operation TEXT NOT NULL, encrypted_data TEXT, device_id TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_sync_log_user_version ON sync_log(user_id, version);
CREATE INDEX IF NOT EXISTS idx_sync_log_user_note ON sync_log(user_id, note_id);
CREATE TABLE IF NOT EXISTS sync_cursors (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, device_id TEXT NOT NULL, last_synced_version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_cursors_unique ON sync_cursors(user_id, device_id);
CREATE TABLE IF NOT EXISTS tag_sync_log (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, tag_id TEXT NOT NULL, version INTEGER NOT NULL, operation TEXT NOT NULL, data TEXT, device_id TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_tag_sync_log_user_version ON tag_sync_log(user_id, version);
CREATE TABLE IF NOT EXISTS notebook_sync_log (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, notebook_id TEXT NOT NULL, version INTEGER NOT NULL, operation TEXT NOT NULL, data TEXT, device_id TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_nb_sync_log_user_version ON notebook_sync_log(user_id, version);
CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, device_id TEXT NOT NULL, name TEXT, platform TEXT, last_seen_at TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_unique ON devices(user_id, device_id);
CREATE TABLE IF NOT EXISTS magic_links (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL);
`.trim();

/**
 * Initialize the test database with all tables.
 * Call in beforeAll or beforeEach.
 */
export async function initTestDb(env: Env): Promise<void> {
  const client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN || undefined,
  });

  const statements = SCHEMA_SQL.split('\n').filter(s => s.trim().length > 0);
  for (const sql of statements) {
    await client.execute(sql);
  }
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
