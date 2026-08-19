export type WikilinkClickAction =
  | { kind: 'heading'; noteId: string; heading: string }
  | { kind: 'open'; noteId: string; heading?: string }
  | { kind: 'create'; title: string }
  | { kind: 'ignore' };

/** Decide whether a followed wikilink jumps, opens, or creates. */
export function resolveWikilinkClick(input: {
  title: string;
  heading?: string;
  currentNote?: { id: string; title: string } | null;
  match?: { id: string } | null;
}): WikilinkClickAction {
  const title = input.title.trim();
  const heading = input.heading?.trim();
  if (
    heading &&
    input.currentNote &&
    (!title || input.currentNote.title.toLowerCase() === title.toLowerCase())
  ) {
    return { kind: 'heading', noteId: input.currentNote.id, heading };
  }
  if (!title) return { kind: 'ignore' };
  if (!input.match) return { kind: 'create', title };
  return heading
    ? { kind: 'open', noteId: input.match.id, heading }
    : { kind: 'open', noteId: input.match.id };
}
