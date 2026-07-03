/**
 * Add board_stage column to notes for the Planning Kanban board.
 *
 * Nullable: only notes tracked on the Planning board carry a stage
 * (backlog / todo / in_progress / in_review / in_staging). NULL means the
 * note is not on the board. Persisted as DB metadata — the note's markdown
 * is never modified when a card moves between columns.
 */

import type { Migration } from '@dripnex/storage-core';

export const addBoardStage: Migration = {
  version: 20260703000018,
  name: 'add_board_stage',
  up: `
    -- Add board_stage column (nullable; NULL = not on the board)
    ALTER TABLE notes ADD COLUMN board_stage TEXT;

    -- Index for grouping notes into board columns
    CREATE INDEX IF NOT EXISTS idx_notes_board_stage ON notes(board_stage);

    -- Seed the special Planning notebook (backs the Kanban board; cannot be
    -- deleted). Idempotent: INSERT OR IGNORE on the PRIMARY KEY.
    INSERT OR IGNORE INTO notebooks (id, name, parent_id, depth, "order", created_at, updated_at)
    VALUES ('planning', 'Planning', NULL, 0, 1, datetime('now'), datetime('now'));
  `,
};
