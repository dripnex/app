import { chunkMarkdown } from '@dripnex/core';

export function headingFrom(content: string): string | null {
  const line = content.split(/\r?\n/).find(row => row.trim().length > 0);
  const match = line?.match(/^#{1,6}\s+(.+?)\s*$/);
  return match?.[1]?.trim() || null;
}

export interface PassageSource {
  content: string;
  heading: string | null;
}

export interface PickedPassage {
  id: string;
  title: string;
  content: string;
  heading: string | null;
  score: number;
}

function termScore(text: string, query: string): number {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(term => term.length > 2);
  if (terms.length === 0) return 0;
  const hay = text.toLowerCase();
  return terms.reduce((sum, term) => sum + (hay.includes(term) ? 1 : 0), 0);
}

/** Best passage(s) from stored chunks, or a fresh markdown split. */
export function pickPassages(
  note: { id: string; title: string; content: string },
  query: string,
  stored?: PassageSource[],
  max = 1
): PickedPassage[] {
  const parts: PassageSource[] =
    stored && stored.length > 0
      ? stored
      : chunkMarkdown(note.content).map(chunk => ({
          content: chunk.content,
          heading: chunk.heading,
        }));

  if (parts.length === 0) {
    return [
      {
        id: note.id,
        title: note.title,
        content: note.content,
        heading: null,
        score: 0,
      },
    ];
  }

  return [...parts]
    .map(part => ({
      id: note.id,
      title: note.title,
      content: part.content,
      heading: part.heading,
      score: termScore(`${part.heading ?? ''} ${part.content}`, query),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, max));
}
