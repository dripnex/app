import { describe, expect, it } from 'vitest';
import type { StoredChunk } from '@dripnex/storage-core';
import { createChunkSemanticRetriever } from '../hybrid-retriever.js';

function embedded(id: string, noteId: string, vector: number[]): StoredChunk {
  return {
    id,
    noteId,
    chunkIndex: 0,
    content: `passage ${id}`,
    tokenCount: 2,
    contentHash: id,
    embedding: new Float32Array(vector),
    dim: vector.length,
    model: 'nomic-embed-text',
    updatedAt: 1,
  };
}

describe('createChunkSemanticRetriever', () => {
  it('returns the note whose chunk is closest to the query', async () => {
    const retriever = createChunkSemanticRetriever({
      listEmbedded: async () => [
        embedded('c1', 'note-a', [1, 0]),
        embedded('c2', 'note-b', [0, 1]),
      ],
      embedQuery: async () => [1, 0],
      loadNote: async id => ({ id, title: id, content: `body ${id}` }),
    });
    const hits = await retriever.retrieve('anything', { topK: 1 });
    expect(hits.map(hit => hit.id)).toEqual(['note-a']);
    expect(hits[0]!.snippet).toContain('c1');
  });

  it('returns empty when embedQuery fails', async () => {
    const retriever = createChunkSemanticRetriever({
      listEmbedded: async () => [embedded('c1', 'note-a', [1, 0])],
      embedQuery: async () => {
        throw new Error('offline');
      },
      loadNote: async id => ({ id, title: id, content: id }),
    });
    expect(await retriever.retrieve('q')).toEqual([]);
  });
});
