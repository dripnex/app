/**
 * Guard the FTS update trigger so it only rebuilds the index when a
 * searchable field actually changes.
 *
 * The original notes_fts_update trigger (migration 008) fired on ANY UPDATE,
 * so metadata-only writes (board_stage, board_order, priority, status, pin…)
 * pointlessly deleted+reinserted the note's FTS row. Reordering a Kanban column
 * made this an N× churn. This recreates the trigger with a WHEN clause limiting
 * it to title / content / is_deleted changes.
 */

import type { Migration } from '@dripnex/storage-core';

export const addFtsUpdateGuard: Migration = {
  version: 20260703000021,
  name: 'fts_update_guard',
  up: `
    DROP TRIGGER IF EXISTS notes_fts_update;

    CREATE TRIGGER notes_fts_update AFTER UPDATE ON notes
    WHEN OLD.title IS NOT NEW.title
      OR OLD.content IS NOT NEW.content
      OR OLD.is_deleted IS NOT NEW.is_deleted
    BEGIN
      DELETE FROM notes_fts WHERE id = OLD.id;
      INSERT INTO notes_fts(id, title, content)
      SELECT NEW.id, NEW.title, NEW.content
      WHERE NEW.is_deleted = 0 OR NEW.is_deleted IS NULL;
    END;
  `,
};
