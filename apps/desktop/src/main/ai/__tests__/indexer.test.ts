import { describe, expect, it, vi } from 'vitest';
import type { StoredChunk } from '@dripnex/storage-core';
import { drainPendingEmbeddings } from '../indexer.js';

function chunk(id: string, content: string): StoredChunk {
  return {
    id,
    noteId: 'n1',
    chunkIndex: 0,
    content,
    tokenCount: 1,
    contentHash: id,
    embedding: null,
    dim: null,
    model: null,
    updatedAt: 1,
  };
}

describe('drainPendingEmbeddings', () => {
  it('embeds a batch and writes vectors', async () => {
    const pending = [chunk('a', 'alpha'), chunk('b', 'beta')];
    const updateEmbedding = vi.fn();
    const result = await drainPendingEmbeddings(
      {
        listPending: async limit => pending.splice(0, limit),
        updateEmbedding,
      },
      async texts => texts.map(() => [1, 0, 0]),
      { model: 'nomic-embed-text', dim: 3 }
    );
    expect(result).toEqual({ scanned: 2, embedded: 2, failed: false });
    expect(updateEmbedding).toHaveBeenCalledTimes(2);
  });

  it('stops without writing when embed throws', async () => {
    const updateEmbedding = vi.fn();
    const result = await drainPendingEmbeddings(
      {
        listPending: async () => [chunk('a', 'alpha')],
        updateEmbedding,
      },
      async () => {
        throw new Error('offline');
      },
      { model: 'nomic-embed-text', dim: 3 }
    );
    expect(result.failed).toBe(true);
    expect(result.embedded).toBe(0);
    expect(updateEmbedding).not.toHaveBeenCalled();
  });
});
