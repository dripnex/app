/**
 * Local passage + vector store. Embeddings stay on device (sync is ciphertext).
 */

export interface StoredChunk {
  id: string;
  noteId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  contentHash: string;
  embedding: Float32Array | null;
  dim: number | null;
  model: string | null;
  updatedAt: number;
}

export interface ChunkWrite {
  noteId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  contentHash: string;
  embedding?: ArrayLike<number> | null;
  dim?: number | null;
  model?: string | null;
}

export interface ChunkRepository {
  replaceForNote(noteId: string, chunks: ChunkWrite[]): Promise<void>;
  listForNote(noteId: string): Promise<StoredChunk[]>;
  listEmbedded(filter: { model: string; dim: number }): Promise<StoredChunk[]>;
  listPending(limit?: number): Promise<StoredChunk[]>;
  updateEmbedding(
    id: string,
    embedding: ArrayLike<number>,
    meta: { dim: number; model: string }
  ): Promise<void>;
  deleteForNote(noteId: string): Promise<void>;
  count(): Promise<number>;
  countPending(): Promise<number>;
  countEmbedded(filter: { model: string; dim: number }): Promise<number>;
  /** Drop vectors that do not match the active model so they re-embed. */
  invalidateOtherModels(keep: { model: string; dim: number }): Promise<number>;
}
