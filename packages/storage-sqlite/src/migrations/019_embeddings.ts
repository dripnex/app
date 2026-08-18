/**
 * Local chunk + embedding store. Vectors never leave the device.
 * Version must sort after 018_fts_include_deleted (20260817000001).
 */

import type { Migration } from '@dripnex/storage-core';

export const embeddings: Migration = {
  version: 20260817000002,
  name: 'embeddings',
  up: `
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      token_count INTEGER NOT NULL,
      content_hash TEXT NOT NULL,
      embedding BLOB,
      dim INTEGER,
      model TEXT,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_chunks_note_index
      ON chunks(note_id, chunk_index);
    CREATE INDEX IF NOT EXISTS idx_chunks_note_id ON chunks(note_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_model ON chunks(model);
  `,
};
