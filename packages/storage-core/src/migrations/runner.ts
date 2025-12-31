/**
 * Migration Runner
 *
 * Forward-only migrations for safe schema evolution.
 * Works with any DatabaseAdapter implementation.
 */

import type { DatabaseAdapter } from '../interfaces/DatabaseAdapter.js';
import type { Migration, MigrationRecord } from '../interfaces/Migration.js';

/** Ensure migrations table exists */
function ensureMigrationsTable(db: DatabaseAdapter): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

/** Get applied migrations */
function getAppliedMigrations(db: DatabaseAdapter): number[] {
  const stmt = db.prepare<MigrationRecord>('SELECT version FROM _migrations ORDER BY version');
  const rows = stmt.all() as MigrationRecord[];
  return rows.map(r => r.version);
}

/** Record a migration as applied */
function recordMigration(db: DatabaseAdapter, migration: Migration): void {
  const stmt = db.prepare('INSERT INTO _migrations (version, name) VALUES (?, ?)');
  stmt.run(migration.version, migration.name);
}

/** Run pending migrations */
export function runMigrations(db: DatabaseAdapter, migrations: Migration[]): void {
  // Ensure migrations table exists
  ensureMigrationsTable(db);

  // Get already applied migrations
  const applied = new Set(getAppliedMigrations(db));

  // Sort migrations by version
  const sorted = [...migrations].sort((a, b) => a.version - b.version);

  // Run pending migrations in a transaction
  db.transaction(() => {
    for (const migration of sorted) {
      if (applied.has(migration.version)) {
        continue; // Already applied
      }

      console.log(`Running migration ${migration.version}: ${migration.name}`);

      // Execute migration SQL
      db.exec(migration.up);

      // Record as applied
      recordMigration(db, migration);
    }
  });
}

/** Get list of pending migrations */
export function getPendingMigrations(db: DatabaseAdapter, migrations: Migration[]): Migration[] {
  ensureMigrationsTable(db);
  const applied = new Set(getAppliedMigrations(db));

  return migrations
    .filter(m => !applied.has(m.version))
    .sort((a, b) => a.version - b.version);
}

/** Get current database version */
export function getCurrentVersion(db: DatabaseAdapter): number {
  ensureMigrationsTable(db);
  const applied = getAppliedMigrations(db);
  return applied.length > 0 ? Math.max(...applied) : 0;
}
