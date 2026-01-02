/**
 * Add isPinned, isDeleted, and status fields to notes
 */

import type { Migration } from '@readied/storage-core';

export const addNoteFields: Migration = {
  version: 20250102000004,
  name: 'add_note_fields',
  up: `
    -- Add is_pinned column (boolean as INTEGER)
    ALTER TABLE notes ADD COLUMN is_pinned INTEGER DEFAULT 0;

    -- Add is_deleted column for soft delete/trash (boolean as INTEGER)
    ALTER TABLE notes ADD COLUMN is_deleted INTEGER DEFAULT 0;

    -- Add status column for workflow tracking
    ALTER TABLE notes ADD COLUMN status TEXT DEFAULT 'active';

    -- Index for filtering pinned notes
    CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned);

    -- Index for filtering deleted notes
    CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(is_deleted);

    -- Index for filtering by status
    CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status);

    -- Composite index for common queries (active, non-deleted notes)
    CREATE INDEX IF NOT EXISTS idx_notes_active ON notes(is_deleted, status);
  `,
};
