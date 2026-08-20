import { extractExcerpt } from '../hooks/useNotes';

export type WikilinkPeekResult =
  | { kind: 'note'; title: string; excerpt: string }
  | { kind: 'missing'; title: string };

export async function resolveWikilinkPeek(
  title: string,
  search: (query: string) => Promise<ReadonlyArray<{ title: string; content: string }>>
): Promise<WikilinkPeekResult | null> {
  const query = title.trim();
  if (!query) return null;
  const notes = await search(query);
  const match = notes.find(note => note.title.toLowerCase() === query.toLowerCase());
  if (!match) return { kind: 'missing', title: query };
  return { kind: 'note', title: match.title, excerpt: extractExcerpt(match.content, 160) };
}
