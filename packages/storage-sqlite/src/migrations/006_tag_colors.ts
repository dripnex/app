/**
 * Tag Colors Migration
 *
 * Adds 'color' column to tags table for customizable tag colors.
 */

import type { Migration } from '@dripnex/storage-core';

export const addTagColors: Migration = {
  version: 20250102000002,
  name: 'tag_colors',
  up: `
    -- Add color column to tags table
    -- Risk: If DB is corrupt/incomplete, this may fail
    -- In that case, user must reset DB
    PRAGMA foreign_keys=off;
    ALTER TABLE tags ADD COLUMN color TEXT;
    PRAGMA foreign_keys=on;
  `,
};
