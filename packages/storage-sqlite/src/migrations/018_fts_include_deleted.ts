/**
 * Index deleted notes in FTS so search can filter is_deleted in SQL.
 */

import type { Migration } from '@dripnex/storage-core';

export const ftsIncludeDeleted: Migration = {
  version: 20260817000001,
  name: 'fts_include_deleted',
  up: `
    DROP TRIGGER IF EXISTS notes_fts_insert;
    DROP TRIGGER IF EXISTS notes_fts_update;

    CREATE TRIGGER notes_fts_insert AFTER INSERT ON notes
    BEGIN
      INSERT INTO notes_fts(id, title, content)
      VALUES (NEW.id, NEW.title, NEW.content);
    END;

    CREATE TRIGGER notes_fts_update AFTER UPDATE ON notes
    BEGIN
      DELETE FROM notes_fts WHERE id = OLD.id;
      INSERT INTO notes_fts(id, title, content)
      VALUES (NEW.id, NEW.title, NEW.content);
    END;

    INSERT INTO notes_fts(id, title, content)
    SELECT id, title, content FROM notes
    WHERE is_deleted = 1
      AND id NOT IN (SELECT id FROM notes_fts);
  `,
};
