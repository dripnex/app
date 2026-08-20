/**
 * Sync Fields Migration
 *
 * Adds fields required for cloud sync:
 * - device_id: which device last modified the entity
 * - sync_version: increments on each remote sync
 * - last_synced_at: when entity was last synced
 *
 * Also creates:
 * - sync_queue: offline changes waiting to be synced
 * - sync_metadata: key-value store for sync state (cursor, device_id, etc.)
 */

import type { Migration } from '@dripnex/storage-core';

export const addSyncFields: Migration = {
  version: 20260107000002,
  name: 'sync_fields',
  up: `
    -- Add sync fields to notes table
    ALTER TABLE notes ADD COLUMN device_id TEXT;
    ALTER TABLE notes ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE notes ADD COLUMN last_synced_at TEXT;

    -- Add sync fields to notebooks table
    ALTER TABLE notebooks ADD COLUMN device_id TEXT;
    ALTER TABLE notebooks ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE notebooks ADD COLUMN last_synced_at TEXT;

    -- Sync queue for offline changes
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      data TEXT,
      timestamp TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );

    -- Index for finding pending sync items
    CREATE INDEX IF NOT EXISTS idx_sync_queue_pending
    ON sync_queue(synced, timestamp);

    -- Index for finding by entity
    CREATE INDEX IF NOT EXISTS idx_sync_queue_entity
    ON sync_queue(entity_type, entity_id);

    -- Sync metadata (key-value store)
    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- Initialize metadata
    INSERT OR IGNORE INTO sync_metadata (key, value) VALUES ('device_id', NULL);
    INSERT OR IGNORE INTO sync_metadata (key, value) VALUES ('note_cursor', NULL);
    INSERT OR IGNORE INTO sync_metadata (key, value) VALUES ('notebook_cursor', NULL);
    INSERT OR IGNORE INTO sync_metadata (key, value) VALUES ('last_synced_at', NULL);

    -- Index on sync_version for finding modified notes
    CREATE INDEX IF NOT EXISTS idx_notes_sync_version ON notes(sync_version);
    CREATE INDEX IF NOT EXISTS idx_notebooks_sync_version ON notebooks(sync_version);
  `,
};
