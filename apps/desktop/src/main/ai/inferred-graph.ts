import { cosineSimilarity } from '@dripnex/ai-core';

export interface InferredEdge {
  source: string;
  target: string;
  score: number;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function meanVector(vectors: Array<ArrayLike<number>>): Float32Array | null {
  if (vectors.length === 0) return null;
  const dim = vectors[0]?.length ?? 0;
  if (dim === 0) return null;
  const out = new Float32Array(dim);
  for (const vector of vectors) {
    if (vector.length !== dim) continue;
    for (let i = 0; i < dim; i += 1) {
      out[i] = (out[i] ?? 0) + (vector[i] ?? 0);
    }
  }
  const n = vectors.length;
  for (let i = 0; i < dim; i += 1) {
    out[i] = (out[i] ?? 0) / n;
  }
  return out;
}

/**
 * Pairwise cosine over per-note mean vectors.
 * Skips pairs already present as wikilinks. Does not log passage text.
 */
export function inferEdgesFromChunks(
  chunks: Array<{ noteId: string; embedding: ArrayLike<number> }>,
  existingPairs: Iterable<string>,
  options?: { minScore?: number; maxPerNote?: number }
): InferredEdge[] {
  const minScore = options?.minScore ?? 0.78;
  const maxPerNote = options?.maxPerNote ?? 3;
  const blocked = new Set(existingPairs);

  const byNote = new Map<string, Array<ArrayLike<number>>>();
  for (const chunk of chunks) {
    const list = byNote.get(chunk.noteId) ?? [];
    list.push(chunk.embedding);
    byNote.set(chunk.noteId, list);
  }

  const notes: Array<{ id: string; vector: Float32Array }> = [];
  for (const [id, vectors] of byNote) {
    const vector = meanVector(vectors);
    if (vector) notes.push({ id, vector });
  }

  const best = new Map<string, InferredEdge[]>();
  for (let i = 0; i < notes.length; i += 1) {
    for (let j = i + 1; j < notes.length; j += 1) {
      const left = notes[i]!;
      const right = notes[j]!;
      if (blocked.has(pairKey(left.id, right.id))) continue;
      const score = cosineSimilarity(left.vector, right.vector);
      if (score < minScore) continue;
      const edge = { source: left.id, target: right.id, score };
      const leftList = best.get(left.id) ?? [];
      const rightList = best.get(right.id) ?? [];
      leftList.push(edge);
      rightList.push(edge);
      best.set(left.id, leftList);
      best.set(right.id, rightList);
    }
  }

  const seen = new Set<string>();
  const out: InferredEdge[] = [];
  for (const [id, edges] of best) {
    edges.sort((a, b) => b.score - a.score);
    let kept = 0;
    for (const edge of edges) {
      if (kept >= maxPerNote) break;
      const key = pairKey(edge.source, edge.target);
      if (seen.has(key)) {
        kept += 1;
        continue;
      }
      seen.add(key);
      out.push(edge);
      kept += 1;
    }
    void id;
  }
  return out.sort((a, b) => b.score - a.score);
}
