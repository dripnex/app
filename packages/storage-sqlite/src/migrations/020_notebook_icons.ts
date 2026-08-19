/**
 * Per-notebook sidebar icon (lucide id).
 */

import type { Migration } from '@dripnex/storage-core';

export const notebookIcons: Migration = {
  version: 20260819000001,
  name: 'notebook_icons',
  up: `
    ALTER TABLE notebooks ADD COLUMN icon TEXT;
  `,
};
