/**
 * Tag Sync Tracking Migration
 *
 * Adds UUID for sync identity, plus sync tracking columns to tags table.
 * Tags use INTEGER autoincrement locally but need a UUID for cross-device identity.
 */

import type { Migration } from '@dripnex/storage-core';

export const tagSyncTracking: Migration = {
  version: 20250311000003,
  name: 'tag_sync_tracking',
  up: `
    -- Add UUID for cross-device identity
    ALTER TABLE tags ADD COLUMN uuid TEXT;

    -- Backfill existing tags with generated UUIDs
    UPDATE tags SET uuid = (
      lower(hex(randomblob(4))) || '-' ||
      lower(hex(randomblob(2))) || '-' ||
      '4' || lower(substr(hex(randomblob(2)), 2)) || '-' ||
      lower(substr('89ab', abs(random()) % 4 + 1, 1)) || lower(substr(hex(randomblob(2)), 2)) || '-' ||
      lower(hex(randomblob(6)))
    ) WHERE uuid IS NULL;

    -- Sync tracking columns
    ALTER TABLE tags ADD COLUMN local_version INTEGER DEFAULT 1;
    ALTER TABLE tags ADD COLUMN needs_sync INTEGER DEFAULT 0;
    ALTER TABLE tags ADD COLUMN last_synced_at TEXT;

    -- Index for finding tags that need syncing
    CREATE INDEX IF NOT EXISTS idx_tags_needs_sync
    ON tags(needs_sync) WHERE needs_sync = 1;

    -- Unique index on UUID
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_uuid
    ON tags(uuid);

    -- Trigger: track tag updates (name or color changes)
    CREATE TRIGGER IF NOT EXISTS tags_update_sync_tracking
    AFTER UPDATE OF name, color ON tags
    WHEN OLD.name != NEW.name OR OLD.color IS NOT NEW.color
    BEGIN
      UPDATE tags SET
        local_version = local_version + 1,
        needs_sync = 1
      WHERE id = NEW.id;
    END;

    -- Trigger: mark new tags for sync
    CREATE TRIGGER IF NOT EXISTS tags_insert_sync_tracking
    AFTER INSERT ON tags
    BEGIN
      UPDATE tags SET needs_sync = 1 WHERE id = NEW.id;
    END;
  `,
};
