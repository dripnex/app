/**
 * Migration Runner
 *
 * Forward-only migrations for safe schema evolution
 */

import type { DatabaseConnection } from '../database.js';

/** A single migration */
export interface Migration {
  /** Unique version identifier (use timestamp format: 20241231120000) */
  version: number;
  /** Human-readable name */
  name: string;
  /** SQL to execute (forward only, no rollback) */
  up: string;
}

/** Migration status record */
interface MigrationRecord {
  version: number;
  name: string;
  applied_at: string;
}

/** Ensure migrations table exists */
function ensureMigrationsTable(db: DatabaseConnection): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

/** Get applied migrations */
function getAppliedMigrations(db: DatabaseConnection): number[] {
  const stmt = db.prepare<MigrationRecord>('SELECT version FROM _migrations ORDER BY version');
  const rows = stmt.all() as MigrationRecord[];
  return rows.map(r => r.version);
}

/** Record a migration as applied */
function recordMigration(db: DatabaseConnection, migration: Migration): void {
  const stmt = db.prepare('INSERT INTO _migrations (version, name) VALUES (?, ?)');
  stmt.run(migration.version, migration.name);
}

/** Run pending migrations */
export function runMigrations(db: DatabaseConnection, migrations: Migration[]): void {
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
export function getPendingMigrations(db: DatabaseConnection, migrations: Migration[]): Migration[] {
  ensureMigrationsTable(db);
  const applied = new Set(getAppliedMigrations(db));

  return migrations
    .filter(m => !applied.has(m.version))
    .sort((a, b) => a.version - b.version);
}

/** Get current database version */
export function getCurrentVersion(db: DatabaseConnection): number {
  ensureMigrationsTable(db);
  const applied = getAppliedMigrations(db);
  return applied.length > 0 ? Math.max(...applied) : 0;
}
