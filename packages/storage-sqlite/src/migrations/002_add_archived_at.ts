/**
 * Add archived_at column for soft delete
 */

import type { Migration } from '@readied/storage-core';

export const addArchivedAt: Migration = {
  version: 20241231000002,
  name: 'add_archived_at',
  up: `
    -- Add archived_at column to notes table
    ALTER TABLE notes ADD COLUMN archived_at TEXT DEFAULT NULL;

    -- Index for filtering archived/active notes
    CREATE INDEX IF NOT EXISTS idx_notes_archived_at ON notes(archived_at);
  `,
};
