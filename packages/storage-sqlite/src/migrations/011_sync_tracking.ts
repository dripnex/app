/**
 * Add sync tracking columns for bidirectional sync
 *
 * Enables tracking which notes need to be pushed to the server.
 * Local changes are marked with needs_sync=1 and synced when connection available.
 */

import type { Migration } from '@dripnex/storage-core';

export const syncTracking: Migration = {
  version: 20260109000008,
  name: 'sync_tracking',
  up: `
    -- Add local_version column
    -- Incremented on each local change, used for conflict detection
    ALTER TABLE notes ADD COLUMN local_version INTEGER DEFAULT 1;

    -- Add needs_sync flag
    -- 1 = note has local changes that need to be pushed to server
    -- 0 = note is in sync with server
    ALTER TABLE notes ADD COLUMN needs_sync INTEGER DEFAULT 0;

    -- last_synced_at already added by migration 010_sync_fields

    -- Index for querying pending changes
    CREATE INDEX IF NOT EXISTS idx_notes_needs_sync ON notes(needs_sync) WHERE needs_sync = 1;

    -- Trigger: Mark note as needing sync on UPDATE
    CREATE TRIGGER IF NOT EXISTS notes_update_sync_tracking
    AFTER UPDATE ON notes
    FOR EACH ROW
    WHEN NEW.content != OLD.content
      OR NEW.title != OLD.title
      OR NEW.is_pinned != OLD.is_pinned
      OR NEW.status != OLD.status
      OR NEW.notebook_id != OLD.notebook_id
    BEGIN
      UPDATE notes
      SET
        needs_sync = 1,
        local_version = local_version + 1
      WHERE id = NEW.id;
    END;

    -- Trigger: Mark note as needing sync on INSERT
    CREATE TRIGGER IF NOT EXISTS notes_insert_sync_tracking
    AFTER INSERT ON notes
    FOR EACH ROW
    BEGIN
      UPDATE notes
      SET needs_sync = 1
      WHERE id = NEW.id;
    END;

    -- Note: DELETE handling is done in application code
    -- Soft deletes (is_deleted=1) will trigger UPDATE trigger
    -- Hard deletes need to send DELETE operation to server before removing from DB
  `,
};
