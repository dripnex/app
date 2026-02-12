/**
 * Add sync tracking columns for notebooks (bidirectional sync)
 *
 * Mirrors the sync tracking pattern from 011_sync_tracking (notes)
 * so notebooks can be pushed to the server.
 */

import type { Migration } from '@readied/storage-core';

export const notebookSyncTracking: Migration = {
  version: 20260211000015,
  name: 'notebook_sync_tracking',
  up: `
    -- Add local_version column to notebooks
    -- Incremented on each local change, used for conflict detection
    ALTER TABLE notebooks ADD COLUMN local_version INTEGER DEFAULT 1;

    -- Add needs_sync flag to notebooks
    -- 1 = notebook has local changes that need to be pushed to server
    -- 0 = notebook is in sync with server
    ALTER TABLE notebooks ADD COLUMN needs_sync INTEGER DEFAULT 0;

    -- Index for querying pending changes
    CREATE INDEX IF NOT EXISTS idx_notebooks_needs_sync ON notebooks(needs_sync) WHERE needs_sync = 1;

    -- Trigger: Mark notebook as needing sync on UPDATE
    CREATE TRIGGER IF NOT EXISTS notebooks_update_sync_tracking
    AFTER UPDATE ON notebooks
    FOR EACH ROW
    WHEN NEW.name != OLD.name
      OR COALESCE(NEW.parent_id, '') != COALESCE(OLD.parent_id, '')
      OR NEW."order" != OLD."order"
      OR NEW.depth != OLD.depth
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

    -- Note: DELETE handling is done in application code
    -- Hard deletes need to send DELETE operation to server before removing from DB
  `,
};
