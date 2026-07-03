/**
 * Add priority column to notes (Linear-style priority for the Planning board).
 *
 * Non-null with a 'none' default, mirroring the existing `status` column.
 * Persisted as DB metadata — setting a priority never modifies the note's
 * markdown.
 */

import type { Migration } from '@dripnex/storage-core';

export const addNotePriority: Migration = {
  version: 20260703000019,
  name: 'add_note_priority',
  up: `
    -- Add priority column (default 'none')
    ALTER TABLE notes ADD COLUMN priority TEXT DEFAULT 'none';

    -- Index for filtering/sorting by priority
    CREATE INDEX IF NOT EXISTS idx_notes_priority ON notes(priority);
  `,
};
