import {
  createHybridRetriever,
  createKeywordRetriever,
  rankByCosine,
  retrieveWithRelated,
  type RetrievedNote,
  type Retriever,
} from '@dripnex/ai-core';
import type { StoredChunk } from '@dripnex/storage-core';
import { createNoteId } from '@dripnex/core';
import type { SQLiteNoteRepository } from '../handlers/types.js';
import { headingFrom, pickPassages } from './passages.js';

function snippetFrom(content: string, max = 200): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, max);
}

export function createSqliteRetriever(repo: SQLiteNoteRepository) {
  return createKeywordRetriever(async (query, limit) => {
    const notes = await repo.search(query, limit);
    return notes.map(note => ({
      id: note.id,
      title: note.title,
      snippet: snippetFrom(note.content),
      content: note.content,
    }));
  });
}

export function createChunkSemanticRetriever(deps: {
  listEmbedded: () => Promise<StoredChunk[]>;
  loadNote: (id: string) => Promise<{ id: string; title: string; content: string } | null>;
  embedQuery: (query: string) => Promise<number[]>;
}): Retriever {
  return {
    async retrieve(query, options = {}) {
      const trimmed = query.trim();
      if (!trimmed) return [];
      let vector: number[];
      try {
        vector = await deps.embedQuery(trimmed);
      } catch {
        return [];
      }
      const chunks = await deps.listEmbedded();
      const usable = chunks.filter(chunk => chunk.embedding);
      if (usable.length === 0) return [];

      const ranked = rankByCosine(
        vector,
        usable.map(chunk => ({ id: chunk.id, embedding: chunk.embedding! })),
        (options.topK ?? 10) * 4
      );
      const exclude = new Set(options.excludeIds ?? []);
      const seenNotes = new Set<string>();
      const hits: RetrievedNote[] = [];

      for (const item of ranked) {
        const chunk = usable.find(row => row.id === item.id);
        if (!chunk || seenNotes.has(chunk.noteId) || exclude.has(chunk.noteId)) continue;
        const note = await deps.loadNote(chunk.noteId);
        if (!note) continue;
        seenNotes.add(chunk.noteId);
        hits.push({
          id: note.id,
          title: note.title,
          snippet: snippetFrom(chunk.content),
          content: note.content,
        });
        if (hits.length >= (options.topK ?? 10)) break;
      }
      return hits;
    },
  };
}

export async function retrieveAskNotes(
  repo: SQLiteNoteRepository,
  input: {
    query: string;
    relatedQuery?: string | null;
    topK: number;
    excludeIds?: readonly string[];
  },
  extras?: {
    listEmbedded?: () => Promise<StoredChunk[]>;
    embedQuery?: (query: string) => Promise<number[]>;
    countEmbedded?: () => Promise<number>;
    listForNote?: (noteId: string) => Promise<StoredChunk[]>;
  }
): Promise<
  Array<{ id: string; title: string; content: string; heading: string | null; score: number }>
> {
  const keyword = createSqliteRetriever(repo);
  let semanticRetriever: Retriever | undefined;
  if (
    extras?.listEmbedded &&
    extras.embedQuery &&
    extras.countEmbedded &&
    (await extras.countEmbedded()) > 0
  ) {
    semanticRetriever = createChunkSemanticRetriever({
      listEmbedded: extras.listEmbedded,
      embedQuery: extras.embedQuery,
      loadNote: async id => {
        const note = await repo.get(createNoteId(id));
        if (!note) return null;
        return { id: note.id, title: note.title, content: note.content };
      },
    });
  }
  const hits: RetrievedNote[] = await retrieveWithRelated(
    createHybridRetriever({ keyword, semantic: semanticRetriever }),
    input
  );

  const passages: Array<{
    id: string;
    title: string;
    content: string;
    heading: string | null;
    score: number;
  }> = [];
  for (const hit of hits) {
    const stored = extras?.listForNote ? await extras.listForNote(hit.id) : [];
    passages.push(
      ...pickPassages(
        {
          id: hit.id,
          title: hit.title,
          content: hit.content ?? hit.snippet,
        },
        input.query,
        stored.map(chunk => ({
          content: chunk.content,
          heading: headingFrom(chunk.content),
        }))
      )
    );
  }
  return passages;
}
