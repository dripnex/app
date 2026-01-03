/**
 * Manual Tags Migration
 *
 * Adds 'source' column to note_tags to distinguish between
 * content-extracted tags (#tag) and manually-added tags.
 */

import type { Migration } from '@readied/storage-core';

export const addManualTags: Migration = {
  version: 20250102000001,
  name: 'manual_tags',
  up: `
    -- Add source column to track tag origin
    ALTER TABLE note_tags ADD COLUMN source TEXT;

    -- Backfill existing rows as content-extracted
    UPDATE note_tags SET source = 'content' WHERE source IS NULL;

    -- Unique constraint: prevents duplicate (note_id, tag_id, source) tuples
    -- Critical for idempotency and retry safety
    CREATE UNIQUE INDEX IF NOT EXISTS idx_note_tags_unique
    ON note_tags(note_id, tag_id, source);

    -- Performance index for source-filtered queries
    CREATE INDEX IF NOT EXISTS idx_note_tags_source
    ON note_tags(source);
  `,
};
