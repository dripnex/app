import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInMemoryDatabase, type DatabaseConnection } from '../src/database.js';
import {
  runMigrations,
  getPendingMigrations,
  getCurrentVersion,
  allMigrations,
  type Migration,
} from '../src/migrations/index.js';

describe('Migrations', () => {
  let db: DatabaseConnection;

  beforeEach(() => {
    db = createInMemoryDatabase();
  });

  afterEach(() => {
    db.close();
  });

  describe('runMigrations', () => {
    it('runs all migrations on fresh database', () => {
      runMigrations(db, allMigrations);

      // Check that notes table exists
      const tables = db.prepare<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='notes'"
      ).all() as { name: string }[];

      expect(tables.length).toBe(1);
    });

    it('creates migrations table', () => {
      runMigrations(db, allMigrations);

      const tables = db.prepare<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'"
      ).all() as { name: string }[];

      expect(tables.length).toBe(1);
    });

    it('records applied migrations', () => {
      runMigrations(db, allMigrations);

      const migrations = db.prepare<{ version: number }>(
        'SELECT version FROM _migrations'
      ).all() as { version: number }[];

      expect(migrations.length).toBe(allMigrations.length);
    });

    it('does not re-run applied migrations', () => {
      runMigrations(db, allMigrations);
      runMigrations(db, allMigrations); // Run again

      const migrations = db.prepare<{ version: number }>(
        'SELECT version FROM _migrations'
      ).all() as { version: number }[];

      // Should still only have 1 entry per migration
      expect(migrations.length).toBe(allMigrations.length);
    });
  });

  describe('getPendingMigrations', () => {
    it('returns all migrations for fresh database', () => {
      const pending = getPendingMigrations(db, allMigrations);
      expect(pending.length).toBe(allMigrations.length);
    });

    it('returns empty array when all applied', () => {
      runMigrations(db, allMigrations);
      const pending = getPendingMigrations(db, allMigrations);
      expect(pending.length).toBe(0);
    });
  });

  describe('getCurrentVersion', () => {
    it('returns 0 for fresh database', () => {
      const version = getCurrentVersion(db);
      expect(version).toBe(0);
    });

    it('returns latest version after migrations', () => {
      runMigrations(db, allMigrations);
      const version = getCurrentVersion(db);
      expect(version).toBe(allMigrations[allMigrations.length - 1].version);
    });
  });

  describe('initial schema', () => {
    beforeEach(() => {
      runMigrations(db, allMigrations);
    });

    it('creates notes table with correct columns', () => {
      const columns = db.prepare<{ name: string }>(
        "PRAGMA table_info('notes')"
      ).all() as { name: string }[];

      const columnNames = columns.map(c => c.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('content');
      expect(columnNames).toContain('title');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
      expect(columnNames).toContain('word_count');
    });

    it('creates tags table', () => {
      const tables = db.prepare<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='tags'"
      ).all() as { name: string }[];

      expect(tables.length).toBe(1);
    });

    it('creates note_tags junction table', () => {
      const tables = db.prepare<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='note_tags'"
      ).all() as { name: string }[];

      expect(tables.length).toBe(1);
    });
  });
});
