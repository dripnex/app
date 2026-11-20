/**
 * Trash must mark a note dirty, and tags need a place to remember the
 * server sync-log version. Notes and notebooks already have sync_version.
 *
 * The original notes UPDATE trigger ignored is_deleted, so trashing an
 * unpinned note never set needs_sync. 011 already shipped, so this
 * replaces the trigger instead of editing that migration.
 */

import type { Migration } from '@dripnex/storage-core';

export const syncDeleteAndBase: Migration = {
  version: 20261119000001,
  name: 'sync_delete_and_base',
  up: `
    DROP TRIGGER IF EXISTS notes_update_sync_tracking;
    CREATE TRIGGER notes_update_sync_tracking
    AFTER UPDATE ON notes
    FOR EACH ROW
    WHEN NEW.content != OLD.content
      OR NEW.title != OLD.title
      OR NEW.is_pinned != OLD.is_pinned
      OR NEW.status != OLD.status
      OR NEW.notebook_id != OLD.notebook_id
      OR NEW.is_deleted != OLD.is_deleted
    BEGIN
      UPDATE notes
      SET
        needs_sync = 1,
        local_version = local_version + 1
      WHERE id = NEW.id;
    END;

    ALTER TABLE tags ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 0;
  `,
};
