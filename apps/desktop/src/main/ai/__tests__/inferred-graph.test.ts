import { describe, expect, it } from 'vitest';
import { inferEdgesFromChunks } from '../inferred-graph.js';

function vec(noteId: string, values: number[]) {
  return { noteId, embedding: new Float32Array(values) };
}

describe('inferEdgesFromChunks', () => {
  it('skips pairs that already have a wikilink', () => {
    const edges = inferEdgesFromChunks(
      [vec('a', [1, 0]), vec('b', [1, 0]), vec('c', [0.95, 0.05])],
      ['a|b'],
      { minScore: 0.8, maxPerNote: 3 }
    );
    expect(edges.some(edge => pairOf(edge) === 'a|b')).toBe(false);
    expect(edges.some(edge => pairOf(edge) === 'a|c')).toBe(true);
  });

  function pairOf(edge: { source: string; target: string }): string {
    return edge.source < edge.target ? `${edge.source}|${edge.target}` : `${edge.target}|${edge.source}`;
  }

  it('emits a high-score pair when vectors align', () => {
    const edges = inferEdgesFromChunks(
      [vec('a', [1, 0]), vec('b', [1, 0])],
      [],
      { minScore: 0.9, maxPerNote: 2 }
    );
    expect(edges).toHaveLength(1);
    expect(edges[0]?.score).toBeGreaterThan(0.99);
  });
});
