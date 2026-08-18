/**
 * Knowledge-graph vocabulary shared by the editor and the graph.
 * Kind is a reserved tag (concept / source / task / person / idea).
 */

export type NoteKind = 'concept' | 'source' | 'task' | 'person' | 'idea';
export type EdgeKind = 'relates-to' | 'inferred';

export interface NoteKindMeta {
  id: NoteKind;
  label: string;
  color: string;
}

export const NOTE_KINDS: readonly NoteKindMeta[] = [
  { id: 'concept', label: 'Concept', color: '#60a5fa' },
  { id: 'source', label: 'Source', color: '#2dd4bf' },
  { id: 'task', label: 'Task', color: '#fbbf24' },
  { id: 'person', label: 'Person', color: '#f472b6' },
  { id: 'idea', label: 'Idea', color: '#4ade80' },
] as const;

const KIND_IDS = new Set<string>(NOTE_KINDS.map(item => item.id));

export const KIND_BY_ID: Record<NoteKind, NoteKindMeta> = Object.fromEntries(
  NOTE_KINDS.map(item => [item.id, item])
) as Record<NoteKind, NoteKindMeta>;

export function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#/, '').toLowerCase();
}

export function isKindTag(tag: string): boolean {
  return KIND_IDS.has(normalizeTag(tag));
}

export function kindFromTags(
  tags: readonly string[] | undefined,
  status?: 'active' | 'on_hold' | 'completed' | 'dropped'
): NoteKind {
  const names = (tags ?? []).map(normalizeTag);
  for (const kind of NOTE_KINDS) {
    if (names.includes(kind.id)) return kind.id;
  }
  if (status && status !== 'active') return 'task';
  return 'concept';
}

/** Replace any reserved kind tags with `kind`. Other tags stay. */
export function tagsWithKind(tags: readonly string[], kind: NoteKind): string[] {
  const kept = tags.filter(tag => !isKindTag(tag));
  return [...kept, kind];
}

export function kindMeta(kind: NoteKind): NoteKindMeta {
  return KIND_BY_ID[kind];
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
