/**
 * Notebook sync tracking
 *
 * Adds local_version and needs_sync columns to notebooks,
 * plus triggers to track changes for bidirectional sync.
 * Also adds unique constraint to sync_queue to prevent duplicates.
 */

import type { Migration } from '@readied/storage-core';

export const notebookSyncTracking: Migration = {
  version: 20260311000001,
  name: 'notebook_sync_tracking',
  up: `
    -- Add sync tracking columns to notebooks
    ALTER TABLE notebooks ADD COLUMN local_version INTEGER DEFAULT 1;
    ALTER TABLE notebooks ADD COLUMN needs_sync INTEGER DEFAULT 0;

    -- Index for querying pending notebook changes
    CREATE INDEX IF NOT EXISTS idx_notebooks_needs_sync
    ON notebooks(needs_sync) WHERE needs_sync = 1;

    -- Unique constraint on sync_queue to prevent duplicate entries
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_queue_unique_entity
    ON sync_queue(entity_type, entity_id);

    -- Trigger: Mark notebook as needing sync on UPDATE
    CREATE TRIGGER IF NOT EXISTS notebooks_update_sync_tracking
    AFTER UPDATE ON notebooks
    FOR EACH ROW
    WHEN NEW.name != OLD.name
      OR NEW.parent_id IS NOT OLD.parent_id
      OR NEW.depth != OLD.depth
      OR NEW."order" != OLD."order"
    BEGIN
      UPDATE notebooks
      SET
        needs_sync = 1,
        local_version = local_version + 1
      WHERE id = NEW.id;
    END;

    -- Trigger: Mark notebook as needing sync on INSERT
    CREATE TRIGGER IF NOT EXISTS notebooks_insert_sync_tracking
    AFTER INSERT ON notebooks
    FOR EACH ROW
    BEGIN
      UPDATE notebooks
      SET needs_sync = 1
      WHERE id = NEW.id;
    END;
  `,
};
