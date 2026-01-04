/**
 * Links Migration
 *
 * Creates table for tracking note-to-note wikilinks.
 *
 * Design decisions:
 * - target_ref stores the raw link text (e.g., "Note B" from [[Note B]])
 * - target_note_id is nullable for unresolved/broken links
 * - ON DELETE CASCADE cleans up when source/target notes are deleted
 */

import type { Migration } from '@readied/storage-core';

export const addLinks: Migration = {
  version: 20250103000001,
  name: 'links',
  up: `
    -- Create links table for note-to-note relationships
    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_note_id TEXT NOT NULL,
      target_ref TEXT NOT NULL,
      target_note_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(source_note_id, target_ref),
      FOREIGN KEY (source_note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (target_note_id) REFERENCES notes(id) ON DELETE SET NULL
    );

    -- Index for finding backlinks (what links TO this note)
    CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_note_id);

    -- Index for finding outgoing links (what this note links TO)
    CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_note_id);

    -- Index for resolving links by reference text
    CREATE INDEX IF NOT EXISTS idx_links_target_ref ON links(target_ref);
  `,
};
