/**
 * Add board_order column to notes for manual ordering within a Kanban column.
 *
 * Integer, default 0. Persisted as DB metadata — reordering cards never
 * modifies the note's markdown.
 */

import type { Migration } from '@dripnex/storage-core';

export const addBoardOrder: Migration = {
  version: 20260703000020,
  name: 'add_board_order',
  up: `
    -- Add board_order column (default 0)
    ALTER TABLE notes ADD COLUMN board_order INTEGER NOT NULL DEFAULT 0;

    -- Composite index for reading a column's cards in order
    CREATE INDEX IF NOT EXISTS idx_notes_board_order ON notes(board_stage, board_order);
  `,
};
