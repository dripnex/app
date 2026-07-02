import type { Migration } from '@dripnex/storage-core';

export const syncHistory: Migration = {
  version: 20260311000004,
  name: 'sync_history',
  up: `
    CREATE TABLE IF NOT EXISTS sync_history (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      notes_pulled INTEGER NOT NULL DEFAULT 0,
      notes_pushed INTEGER NOT NULL DEFAULT 0,
      notebooks_pulled INTEGER NOT NULL DEFAULT 0,
      notebooks_pushed INTEGER NOT NULL DEFAULT 0,
      tags_pulled INTEGER NOT NULL DEFAULT 0,
      tags_pushed INTEGER NOT NULL DEFAULT 0,
      conflicts INTEGER NOT NULL DEFAULT 0,
      bytes_sent INTEGER NOT NULL DEFAULT 0,
      bytes_received INTEGER NOT NULL DEFAULT 0,
      error_message TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sync_history_started
    ON sync_history(started_at DESC);
  `,
};
