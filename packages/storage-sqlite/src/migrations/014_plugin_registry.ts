import type { Migration } from '@dripnex/storage-core';

export const pluginRegistry: Migration = {
  version: 20260210000002,
  name: 'plugin_registry',
  up: `
    CREATE TABLE IF NOT EXISTS plugin_registry (
      plugin_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 1,
      installed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `,
};
