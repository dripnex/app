import { describe, expect, it } from 'vitest';
import {
  createKeywordRetriever,
  createHybridRetriever,
  retrieveWithRelated,
  cosineSimilarity,
  rankByCosine,
  reciprocalRankFusion,
  type KeywordSearchHit,
} from '../src/retriever';

function hits(ids: string[]): KeywordSearchHit[] {
  return ids.map(id => ({ id, title: id, snippet: id }));
}

describe('createKeywordRetriever', () => {
  it('returns empty for blank queries', async () => {
    const retriever = createKeywordRetriever(async () => hits(['a']));
    expect(await retriever.retrieve('   ')).toEqual([]);
  });

  it('excludes ids and respects topK', async () => {
    const retriever = createKeywordRetriever(async (_q, limit) =>
      hits(['a', 'b', 'c', 'd']).slice(0, limit)
    );
    const result = await retriever.retrieve('q', { topK: 2, excludeIds: ['a'] });
    expect(result.map(h => h.id)).toEqual(['b', 'c']);
  });
});

describe('retrieveWithRelated', () => {
  it('fills remaining slots from the related query', async () => {
    const retriever = createKeywordRetriever(async (query, limit) => {
      const pool = query === 'main' ? ['a', 'b'] : ['b', 'c', 'd'];
      return hits(pool).slice(0, limit);
    });
    const result = await retrieveWithRelated(retriever, {
      query: 'main',
      relatedQuery: 'related',
      topK: 3,
      excludeIds: [],
    });
    expect(result.map(h => h.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('cosineSimilarity', () => {
  it('is 1 for identical vectors and 0 for orthogonal', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 0], [1])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

describe('rankByCosine', () => {
  it('returns the closest vectors first', () => {
    const ranked = rankByCosine(
      [1, 0],
      [
        { id: 'far', embedding: [0, 1] },
        { id: 'near', embedding: [0.9, 0.1] },
        { id: 'same', embedding: [1, 0] },
      ],
      2
    );
    expect(ranked.map(item => item.id)).toEqual(['same', 'near']);
    expect(ranked[0]!.score).toBeCloseTo(1);
  });
});

describe('reciprocalRankFusion', () => {
  it('promotes ids that appear in both lists', () => {
    const fused = reciprocalRankFusion(
      [
        [{ id: 'a' }, { id: 'b' }],
        [{ id: 'b' }, { id: 'c' }],
      ],
      {
        topK: 3,
      }
    );
    expect(fused[0]!.id).toBe('b');
    expect(fused.map(item => item.id).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('createHybridRetriever', () => {
  it('falls back to keyword when semantic is missing', async () => {
    const keyword = createKeywordRetriever(async () => hits(['k']));
    const retriever = createHybridRetriever({ keyword });
    expect((await retriever.retrieve('q')).map(hit => hit.id)).toEqual(['k']);
  });

  it('fuses keyword and semantic ranks', async () => {
    const keyword = createKeywordRetriever(async () => hits(['a', 'b']));
    const semantic = createKeywordRetriever(async () => hits(['b', 'c']));
    const retriever = createHybridRetriever({ keyword, semantic });
    const result = await retriever.retrieve('q', { topK: 3 });
    expect(result[0]!.id).toBe('b');
  });
});
