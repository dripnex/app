export interface RetrievedNote {
  id: string;
  title: string;
  snippet: string;
  content?: string;
}

export interface RetrieveOptions {
  topK?: number;
  excludeIds?: readonly string[];
}

export interface Retriever {
  retrieve(query: string, options?: RetrieveOptions): Promise<RetrievedNote[]>;
}

export interface KeywordSearchHit {
  id: string;
  title: string;
  snippet: string;
  content?: string;
}

/**
 * Keyword retriever. Search is injected so ai-core stays free of SQLite.
 * A later vector retriever can implement the same interface.
 */
export function createKeywordRetriever(
  search: (query: string, limit: number) => Promise<KeywordSearchHit[]>
): Retriever {
  return {
    async retrieve(query, options = {}) {
      const trimmed = query.trim();
      if (!trimmed) return [];
      const topK = options.topK ?? 10;
      const exclude = new Set(options.excludeIds ?? []);
      const fetch = topK + exclude.size;
      const hits = await search(trimmed, fetch);
      return hits.filter(hit => !exclude.has(hit.id)).slice(0, topK);
    },
  };
}

/** Cosine similarity in [-1, 1]. Length mismatch or a zero vector is 0. */
export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / Math.sqrt(normA * normB);
}

/** Rank items by cosine similarity to a query vector. */
export function rankByCosine(
  query: ArrayLike<number>,
  items: ReadonlyArray<{ id: string; embedding: ArrayLike<number> }>,
  topK: number
): Array<{ id: string; score: number }> {
  if (topK <= 0 || query.length === 0) return [];
  return items
    .map(item => ({ id: item.id, score: cosineSimilarity(query, item.embedding) }))
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, topK);
}

/** Reciprocal rank fusion. `k` defaults to 60 (Cormack et al.). */
export function reciprocalRankFusion(
  lists: ReadonlyArray<ReadonlyArray<{ id: string }>>,
  options?: { k?: number; topK?: number }
): Array<{ id: string; score: number }> {
  const k = options?.k ?? 60;
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((item, rank) => {
      scores.set(item.id, (scores.get(item.id) ?? 0) + 1 / (k + rank + 1));
    });
  }
  const ranked = [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((left, right) => right.score - left.score);
  return options?.topK ? ranked.slice(0, options.topK) : ranked;
}

/**
 * Fuse keyword + optional semantic lists. Without a semantic retriever this
 * is just the keyword path — safe to wire before the vector index is full.
 */
export function createHybridRetriever(parts: {
  keyword: Retriever;
  semantic?: Retriever;
}): Retriever {
  return {
    async retrieve(query, options) {
      if (!parts.semantic) return parts.keyword.retrieve(query, options);
      const topK = options?.topK ?? 10;
      const widened = { ...options, topK: topK * 2 };
      const [keywordHits, semanticHits] = await Promise.all([
        parts.keyword.retrieve(query, widened),
        parts.semantic.retrieve(query, widened),
      ]);
      const fused = reciprocalRankFusion([keywordHits, semanticHits], { topK });
      const byId = new Map<string, RetrievedNote>();
      for (const hit of [...semanticHits, ...keywordHits]) byId.set(hit.id, hit);
      return fused
        .map(item => byId.get(item.id))
        .filter((hit): hit is RetrievedNote => Boolean(hit));
    },
  };
}

/** Merge a primary query with an optional related query (current note title). */
export async function retrieveWithRelated(
  retriever: Retriever,
  input: {
    query: string;
    relatedQuery?: string | null;
    topK: number;
    excludeIds?: readonly string[];
  }
): Promise<RetrievedNote[]> {
  const exclude = [...(input.excludeIds ?? [])];
  const primary = await retriever.retrieve(input.query, { topK: input.topK, excludeIds: exclude });
  if (primary.length >= input.topK || !input.relatedQuery?.trim()) {
    return primary;
  }
  const more = await retriever.retrieve(input.relatedQuery, {
    topK: input.topK - primary.length,
    excludeIds: [...exclude, ...primary.map(hit => hit.id)],
  });
  return [...primary, ...more];
}
