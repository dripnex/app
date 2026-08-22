import { randomUUID } from 'node:crypto';
import { unlinkSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { describe, expect, it, afterEach } from 'vitest';
import { applyMigrations, isBenignSchemaError, splitStatements } from '../src/db/runMigrations.js';
import { MIGRATIONS } from '../src/db/migrations.generated.js';

describe('splitStatements / isBenignSchemaError', () => {
  it('splits drizzle breakpoints', () => {
    expect(splitStatements('A;--> statement-breakpoint\nB;')).toEqual(['A;', 'B;']);
  });

  it('treats already-exists as benign', () => {
    expect(isBenignSchemaError('duplicate column name: owner_user_id')).toBe(true);
    expect(isBenignSchemaError('table users already exists')).toBe(true);
    expect(isBenignSchemaError('UNIQUE constraint failed')).toBe(false);
  });
});

describe('applyMigrations', () => {
  const paths: string[] = [];

  afterEach(() => {
    for (const path of paths.splice(0)) {
      try {
        unlinkSync(path);
      } catch {
        // ignore
      }
    }
  });

  // These two drive a real libsql file database through the entire migration
  // catalog — the second one twice. That is legitimately slower than vitest's
  // 5s default (3.0s and 7.4s on CI), so they carry their own budget rather
  // than the suite carrying a global bump that would mask slow unit tests.
  const MIGRATION_TIMEOUT_MS = 30_000;

  it(
    'applies the catalog to an empty database, then no-ops',
    async () => {
      const path = `/tmp/dripnex-migrate-${randomUUID()}.db`;
      paths.push(path);
      const client = createClient({ url: `file:${path}` });

      const first = await applyMigrations(client);
      expect(first.skipped).toEqual([]);
      expect(first.applied.length + first.recordedExisting.length).toBe(MIGRATIONS.length);

      const tables = await client.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='plugin_versions'"
      );
      expect(tables.rows).toHaveLength(1);

      const second = await applyMigrations(client);
      expect(second.applied).toEqual([]);
      expect(second.skipped).toEqual(MIGRATIONS.map(m => m.id));
    },
    MIGRATION_TIMEOUT_MS
  );

  it(
    'records migrations that already exist in the schema',
    async () => {
      const path = `/tmp/dripnex-migrate-${randomUUID()}.db`;
      paths.push(path);
      const client = createClient({ url: `file:${path}` });
      await client.execute(
        'CREATE TABLE users (id text PRIMARY KEY, email text, created_at text, updated_at text)'
      );

      const report = await applyMigrations(client);
      expect(report.recordedExisting).toContain('0000_chubby_zzzax');
      const second = await applyMigrations(client);
      expect(second.skipped).toContain('0000_chubby_zzzax');
    },
    MIGRATION_TIMEOUT_MS
  );
});
