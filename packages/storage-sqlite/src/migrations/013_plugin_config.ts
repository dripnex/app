import type { Migration } from '@dripnex/storage-core';

export const pluginConfig: Migration = {
  version: 20260210000001,
  name: 'plugin_config',
  up: `
    CREATE TABLE IF NOT EXISTS plugin_config (
      plugin_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (plugin_id, key)
    );
  `,
};
