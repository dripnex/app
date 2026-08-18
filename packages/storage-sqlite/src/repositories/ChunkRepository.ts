import type { ChunkRepository, ChunkWrite, StoredChunk } from '@dripnex/storage-core';
import type { DatabaseConnection } from '../database.js';
import { blobToEmbedding, chunkRowId, embeddingToBlob } from './chunkHash.js';

interface ChunkRow {
  id: string;
  note_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  content_hash: string;
  embedding: Buffer | null;
  dim: number | null;
  model: string | null;
  updated_at: number;
}

export class SQLiteChunkRepository implements ChunkRepository {
  constructor(private readonly db: DatabaseConnection) {}

  async replaceForNote(noteId: string, chunks: ChunkWrite[]): Promise<void> {
    const now = Date.now();
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM chunks WHERE note_id = ?').run(noteId);
      const insert = this.db.prepare(`
        INSERT INTO chunks (
          id, note_id, chunk_index, content, token_count, content_hash,
          embedding, dim, model, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const chunk of chunks) {
        const embedding = chunk.embedding ?? null;
        insert.run(
          chunkRowId(noteId, chunk.chunkIndex),
          noteId,
          chunk.chunkIndex,
          chunk.content,
          chunk.tokenCount,
          chunk.contentHash,
          embedding ? embeddingToBlob(embedding) : null,
          embedding ? (chunk.dim ?? embedding.length) : (chunk.dim ?? null),
          chunk.model ?? null,
          now
        );
      }
    });
  }

  async listForNote(noteId: string): Promise<StoredChunk[]> {
    const rows = this.db
      .prepare<ChunkRow>(
        `SELECT id, note_id, chunk_index, content, token_count, content_hash,
                embedding, dim, model, updated_at
         FROM chunks WHERE note_id = ? ORDER BY chunk_index ASC`
      )
      .all(noteId);
    return rows.map(rowToStored);
  }

  async listEmbedded(filter: { model: string; dim: number }): Promise<StoredChunk[]> {
    const rows = this.db
      .prepare<ChunkRow>(
        `SELECT id, note_id, chunk_index, content, token_count, content_hash,
                embedding, dim, model, updated_at
         FROM chunks
         WHERE model = ? AND dim = ? AND embedding IS NOT NULL
         ORDER BY note_id ASC, chunk_index ASC`
      )
      .all(filter.model, filter.dim);
    return rows.map(rowToStored);
  }

  async listPending(limit = 64): Promise<StoredChunk[]> {
    const rows = this.db
      .prepare<ChunkRow>(
        `SELECT id, note_id, chunk_index, content, token_count, content_hash,
                embedding, dim, model, updated_at
         FROM chunks
         WHERE embedding IS NULL
         ORDER BY updated_at DESC
         LIMIT ?`
      )
      .all(limit);
    return rows.map(rowToStored);
  }

  async updateEmbedding(
    id: string,
    embedding: ArrayLike<number>,
    meta: { dim: number; model: string }
  ): Promise<void> {
    this.db
      .prepare(
        `UPDATE chunks
         SET embedding = ?, dim = ?, model = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(embeddingToBlob(embedding), meta.dim, meta.model, Date.now(), id);
  }

  async deleteForNote(noteId: string): Promise<void> {
    this.db.prepare('DELETE FROM chunks WHERE note_id = ?').run(noteId);
  }

  async count(): Promise<number> {
    const row = this.db.prepare<{ n: number }>('SELECT COUNT(*) AS n FROM chunks').get();
    return row?.n ?? 0;
  }

  async countPending(): Promise<number> {
    const row = this.db
      .prepare<{ n: number }>('SELECT COUNT(*) AS n FROM chunks WHERE embedding IS NULL')
      .get();
    return row?.n ?? 0;
  }

  async countEmbedded(filter: { model: string; dim: number }): Promise<number> {
    const row = this.db
      .prepare<{ n: number }>(
        `SELECT COUNT(*) AS n FROM chunks
         WHERE model = ? AND dim = ? AND embedding IS NOT NULL`
      )
      .get(filter.model, filter.dim);
    return row?.n ?? 0;
  }

  async invalidateOtherModels(keep: { model: string; dim: number }): Promise<number> {
    const result = this.db
      .prepare(
        `UPDATE chunks
         SET embedding = NULL, dim = NULL, model = NULL, updated_at = ?
         WHERE embedding IS NOT NULL AND (model != ? OR dim != ?)`
      )
      .run(Date.now(), keep.model, keep.dim);
    return result.changes;
  }
}

function rowToStored(row: ChunkRow): StoredChunk {
  return {
    id: row.id,
    noteId: row.note_id,
    chunkIndex: row.chunk_index,
    content: row.content,
    tokenCount: row.token_count,
    contentHash: row.content_hash,
    embedding: row.embedding ? blobToEmbedding(row.embedding) : null,
    dim: row.dim,
    model: row.model,
    updatedAt: row.updated_at,
  };
}
