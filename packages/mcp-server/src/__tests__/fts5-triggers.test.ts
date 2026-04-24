import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from '../db.js';

/**
 * Minimal schema that mirrors the real Readied database enough to
 * exercise the FTS5 triggers that caused "no such module: fts5"
 * when the MCP server used sql.js (which lacks FTS5).
 */
const SCHEMA = `
  CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    word_count INTEGER NOT NULL DEFAULT 0,
    notebook_id TEXT DEFAULT 'inbox',
    is_pinned INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    needs_sync INTEGER DEFAULT 0,
    local_version INTEGER DEFAULT 1,
    sync_version INTEGER DEFAULT 0
  );

  CREATE TABLE notebooks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    depth INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  INSERT INTO notebooks (id, name, created_at, updated_at)
  VALUES ('inbox', 'Inbox', datetime('now'), datetime('now'));

  -- FTS5 virtual table (migration 008)
  CREATE VIRTUAL TABLE notes_fts USING fts5(
    id UNINDEXED,
    title,
    content,
    tokenize='porter unicode61'
  );

  -- Trigger: sync FTS on INSERT
  CREATE TRIGGER notes_fts_insert AFTER INSERT ON notes
  WHEN NEW.is_deleted = 0 OR NEW.is_deleted IS NULL
  BEGIN
    INSERT INTO notes_fts(id, title, content)
    VALUES (NEW.id, NEW.title, NEW.content);
  END;

  -- Trigger: sync FTS on UPDATE (delete + re-insert)
  CREATE TRIGGER notes_fts_update AFTER UPDATE ON notes
  BEGIN
    DELETE FROM notes_fts WHERE id = OLD.id;
    INSERT INTO notes_fts(id, title, content)
    SELECT NEW.id, NEW.title, NEW.content
    WHERE NEW.is_deleted = 0 OR NEW.is_deleted IS NULL;
  END;

  -- Trigger: sync FTS on DELETE
  CREATE TRIGGER notes_fts_delete AFTER DELETE ON notes
  BEGIN
    DELETE FROM notes_fts WHERE id = OLD.id;
  END;
`;

describe('FTS5 trigger execution', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(SCHEMA);
  });

  afterEach(() => {
    db.close();
  });

  it('INSERT fires notes_fts_insert trigger without error', () => {
    const now = new Date().toISOString();

    expect(() => {
      db.prepare(
        `INSERT INTO notes (id, content, title, created_at, updated_at, word_count, notebook_id, status, needs_sync, local_version, sync_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, 1, 0)`
      ).run('note-1', '# Test Note\n\nHello world', 'Test Note', now, now, 2, 'inbox');
    }).not.toThrow();

    const ftsRow = db.prepare('SELECT * FROM notes_fts WHERE notes_fts MATCH ?').get('hello');
    expect(ftsRow).toBeTruthy();
  });

  it('UPDATE fires notes_fts_update trigger without error', () => {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO notes (id, content, title, created_at, updated_at, word_count)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('note-1', '# Original\n\nOriginal content', 'Original', now, now, 2);

    expect(() => {
      db.prepare(
        'UPDATE notes SET content = ?, title = ?, updated_at = ?, word_count = ?, needs_sync = 1, local_version = local_version + 1 WHERE id = ?'
      ).run('# Updated\n\nBrand new content', 'Updated', now, 3, 'note-1');
    }).not.toThrow();

    const oldMatch = db.prepare('SELECT * FROM notes_fts WHERE notes_fts MATCH ?').get('original');
    expect(oldMatch).toBeUndefined();

    const newMatch = db.prepare('SELECT * FROM notes_fts WHERE notes_fts MATCH ?').get('brand');
    expect(newMatch).toBeTruthy();
  });

  it('soft-delete UPDATE removes entry from FTS index', () => {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO notes (id, content, title, created_at, updated_at, word_count)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('note-1', '# Trashable\n\nGoing away', 'Trashable', now, now, 2);

    expect(() => {
      db.prepare(
        'UPDATE notes SET is_deleted = 1, updated_at = ?, needs_sync = 1 WHERE id = ?'
      ).run(now, 'note-1');
    }).not.toThrow();

    const match = db.prepare('SELECT * FROM notes_fts WHERE notes_fts MATCH ?').get('trashable');
    expect(match).toBeUndefined();
  });

  it('DELETE fires notes_fts_delete trigger without error', () => {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO notes (id, content, title, created_at, updated_at, word_count)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('note-1', '# Deletable\n\nWill be removed', 'Deletable', now, now, 3);

    expect(() => {
      db.prepare('DELETE FROM notes WHERE id = ?').run('note-1');
    }).not.toThrow();

    const match = db.prepare('SELECT * FROM notes_fts WHERE notes_fts MATCH ?').get('deletable');
    expect(match).toBeUndefined();
  });
});

describe('FTS5 runtime check', () => {
  it('openDb succeeds with an in-memory database (FTS5 available)', () => {
    const db = openDb(':memory:');
    expect(db).toBeTruthy();
    // Verify FTS5 actually works on the returned connection
    db.prepare('CREATE VIRTUAL TABLE _test_fts USING fts5(x)').run();
    db.prepare('DROP TABLE _test_fts').run();
    db.close();
  });
});
