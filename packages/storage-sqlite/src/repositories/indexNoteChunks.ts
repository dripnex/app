import { chunkMarkdown } from '@dripnex/core';
import type { DatabaseConnection } from '../database.js';
import { chunkRowId, hashChunkContent } from './chunkHash.js';

interface ExistingChunkRow {
  chunk_index: number;
  content_hash: string;
  embedding: Buffer | null;
  dim: number | null;
  model: string | null;
}

/**
 * Rebuild passages for a note. Reuses embedding/model/dim when the
 * content hash is unchanged so a later embed job is not thrown away.
 */
export function indexNoteChunks(db: DatabaseConnection, noteId: string, content: string): void {
  const parts = chunkMarkdown(content);
  const existing = db
    .prepare<ExistingChunkRow>(
      `SELECT chunk_index, content_hash, embedding, dim, model
       FROM chunks WHERE note_id = ?`
    )
    .all(noteId);
  const byIndex = new Map(existing.map(row => [row.chunk_index, row]));
  const now = Date.now();

  db.prepare('DELETE FROM chunks WHERE note_id = ?').run(noteId);
  const insert = db.prepare(`
    INSERT INTO chunks (
      id, note_id, chunk_index, content, token_count, content_hash,
      embedding, dim, model, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const part of parts) {
    const hash = hashChunkContent(part.content);
    const prev = byIndex.get(part.index);
    const reuse = prev !== undefined && prev.content_hash === hash;
    insert.run(
      chunkRowId(noteId, part.index),
      noteId,
      part.index,
      part.content,
      part.tokenCount,
      hash,
      reuse ? prev.embedding : null,
      reuse ? prev.dim : null,
      reuse ? prev.model : null,
      now
    );
  }
}
