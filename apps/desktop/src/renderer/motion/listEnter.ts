/**
 * Which note-list rows should enter.
 * First paint restaggers the visible set; later updates only play newcomers
 * so overlapping rows do not flash when the filter changes.
 */

export const LIST_ENTER_STAGGER_CAP = 10;

export type ListEnterMode = 'none' | 'all' | 'new';

export interface ListEnterPlan {
  mode: ListEnterMode;
  ids: string[];
}

export function planListEnter(args: {
  noteIds: string[];
  seenIds: ReadonlySet<string>;
}): ListEnterPlan {
  if (args.noteIds.length === 0) return { mode: 'none', ids: [] };
  if (args.seenIds.size === 0) return { mode: 'all', ids: args.noteIds };
  const newcomers = args.noteIds.filter(id => !args.seenIds.has(id));
  if (newcomers.length === 0) return { mode: 'none', ids: [] };
  return { mode: 'new', ids: newcomers };
}

export function elementsForNoteIds(ids: string[]): Element[] {
  if (typeof document === 'undefined') return [];
  const out: Element[] = [];
  for (const id of ids) {
    const el = document.getElementById(`note-${id}`);
    if (el) out.push(el);
  }
  return out;
}
