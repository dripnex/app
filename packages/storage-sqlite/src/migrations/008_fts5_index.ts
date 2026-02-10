/**
 * FTS5 Full-Text Search Migration
 *
 * Creates FTS5 virtual table for fast, ranked full-text search.
 *
 * Design decisions:
 * - Uses contentless FTS5 with explicit id column (notes table uses TEXT PRIMARY KEY)
 * - Triggers keep FTS index in sync on INSERT/UPDATE/DELETE
 * - bm25() provides relevance ranking for search results
 */

import type { Migration } from '@readied/storage-core';

export const addFts5Index: Migration = {
  version: 20260106000001,
  name: 'fts5_index',
  up: `
    -- FTS5 virtual table for full-text search
    -- Using contentless mode with explicit id for TEXT PRIMARY KEY compatibility
    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      id UNINDEXED,
      title,
      content,
      tokenize='porter unicode61'
    );

    -- Populate FTS table with existing notes (excluding deleted)
    INSERT INTO notes_fts(id, title, content)
    SELECT id, title, content FROM notes WHERE is_deleted = 0 OR is_deleted IS NULL;

    -- Trigger: Add to FTS on INSERT
    CREATE TRIGGER IF NOT EXISTS notes_fts_insert AFTER INSERT ON notes
    WHEN NEW.is_deleted = 0 OR NEW.is_deleted IS NULL
    BEGIN
      INSERT INTO notes_fts(id, title, content)
      VALUES (NEW.id, NEW.title, NEW.content);
    END;

    -- Trigger: Update FTS on UPDATE (delete + re-insert for FTS5)
    CREATE TRIGGER IF NOT EXISTS notes_fts_update AFTER UPDATE ON notes
    BEGIN
      -- Remove old entry
      DELETE FROM notes_fts WHERE id = OLD.id;
      -- Re-insert if not deleted
      INSERT INTO notes_fts(id, title, content)
      SELECT NEW.id, NEW.title, NEW.content
      WHERE NEW.is_deleted = 0 OR NEW.is_deleted IS NULL;
    END;

    -- Trigger: Remove from FTS on DELETE
    CREATE TRIGGER IF NOT EXISTS notes_fts_delete AFTER DELETE ON notes
    BEGIN
      DELETE FROM notes_fts WHERE id = OLD.id;
    END;
  `,
};
