/**
 * Add notebooks table and notebook_id to notes
 */

import type { Migration } from '@readied/storage-core';

export const addNotebooks: Migration = {
  version: 20241231000003,
  name: 'add_notebooks',
  up: `
    -- Create notebooks table
    CREATE TABLE IF NOT EXISTS notebooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT REFERENCES notebooks(id) ON DELETE CASCADE,
      depth INTEGER NOT NULL DEFAULT 0,
      "order" INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Index for querying children of a notebook
    CREATE INDEX IF NOT EXISTS idx_notebooks_parent ON notebooks(parent_id);

    -- Index for ordering within parent
    CREATE INDEX IF NOT EXISTS idx_notebooks_order ON notebooks(parent_id, "order");

    -- Insert special Inbox notebook (always exists, cannot be deleted)
    INSERT INTO notebooks (id, name, parent_id, depth, "order", created_at, updated_at)
    VALUES ('inbox', 'Inbox', NULL, 0, 0, datetime('now'), datetime('now'));

    -- Add notebook_id to notes (default to inbox)
    -- Note: SQLite doesn't support ADD COLUMN with REFERENCES, so we use application-level validation
    ALTER TABLE notes ADD COLUMN notebook_id TEXT DEFAULT 'inbox';

    -- Index for filtering notes by notebook
    CREATE INDEX IF NOT EXISTS idx_notes_notebook ON notes(notebook_id);
  `,
};
