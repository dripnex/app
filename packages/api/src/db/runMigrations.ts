import { createClient, type Client } from '@libsql/client';
import type { Env } from './client.js';
import { MIGRATIONS, type EmbeddedMigration } from './migrations.generated.js';

const TRACKING_TABLE = `CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY NOT NULL,
  applied_at TEXT NOT NULL
)`;

const ALREADY_APPLIED = /already exists|duplicate column name|duplicate index/i;

export type MigrationReport = {
  applied: string[];
  skipped: string[];
  recordedExisting: string[];
};

export function splitStatements(sql: string): string[] {
  return sql
    .split('--> statement-breakpoint')
    .map(part => part.trim())
    .filter(Boolean);
}

export function isBenignSchemaError(message: string): boolean {
  return ALREADY_APPLIED.test(message);
}

export async function applyMigrations(
  client: Client,
  migrations: EmbeddedMigration[] = MIGRATIONS
): Promise<MigrationReport> {
  await client.execute('PRAGMA foreign_keys = OFF');
  await client.execute(TRACKING_TABLE);

  const done = new Set(
    (await client.execute('SELECT id FROM schema_migrations')).rows.map(row => String(row.id))
  );

  const applied: string[] = [];
  const skipped: string[] = [];
  const recordedExisting: string[] = [];

  for (const migration of [...migrations].sort((a, b) => a.idx - b.idx)) {
    if (done.has(migration.id)) {
      skipped.push(migration.id);
      continue;
    }

    let existed = false;
    for (const statement of splitStatements(migration.sql)) {
      try {
        await client.execute(statement);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!isBenignSchemaError(message)) throw error;
        existed = true;
      }
    }

    await client.execute({
      sql: 'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)',
      args: [migration.id, new Date().toISOString()],
    });
    done.add(migration.id);
    if (existed) recordedExisting.push(migration.id);
    else applied.push(migration.id);
  }

  await client.execute('PRAGMA foreign_keys = ON');
  return { applied, skipped, recordedExisting };
}

function openClient(env: Pick<Env, 'TURSO_DATABASE_URL' | 'TURSO_AUTH_TOKEN'>): Client {
  return createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN || undefined,
  });
}

export async function runMigrations(
  env: Pick<Env, 'TURSO_DATABASE_URL' | 'TURSO_AUTH_TOKEN'>
): Promise<MigrationReport> {
  return applyMigrations(openClient(env));
}

export async function listMigrationStatus(
  env: Pick<Env, 'TURSO_DATABASE_URL' | 'TURSO_AUTH_TOKEN'>
): Promise<{ applied: Array<{ id: string; appliedAt: string }>; pending: string[] }> {
  const client = openClient(env);
  await client.execute(TRACKING_TABLE);
  const rows = (await client.execute('SELECT id, applied_at FROM schema_migrations ORDER BY id')).rows;
  const applied = rows.map(row => ({
    id: String(row.id),
    appliedAt: String(row.applied_at),
  }));
  const have = new Set(applied.map(row => row.id));
  return {
    applied,
    pending: MIGRATIONS.filter(m => !have.has(m.id)).map(m => m.id),
  };
}

/** Once per isolate. Concurrent requests share the same promise. */
let pending: Promise<MigrationReport> | null = null;

export function ensureMigrated(env: Env): Promise<MigrationReport | null> {
  if (!env?.TURSO_DATABASE_URL || env.ENVIRONMENT === 'test') {
    return Promise.resolve(null);
  }
  if (!pending) {
    pending = runMigrations(env);
  }
  return pending;
}
