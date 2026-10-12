import type { PluginManifest } from '@dripnex/plugin-api';

const TEMPLATES = 'templates';

function tagCount(tags: readonly string[]): number {
  const seen = new Set<string>();
  for (const tag of tags) {
    const name = tag.trim().toLowerCase();
    if (name) seen.add(name);
  }
  return seen.size;
}

/** Note with the most unique tags. Ties go to the oldest. Templates and the current note stay out. */
export function mostTaggedNoteId(
  notes: ReadonlyArray<{
    id: string;
    notebookId: string;
    updatedAt: string;
    tags: readonly string[];
  }>,
  exclude?: string | null
): string | null {
  const pool = notes.filter(
    note => note.id !== exclude && note.notebookId !== TEMPLATES && tagCount(note.tags) > 0
  );
  if (pool.length === 0) return null;
  pool.sort((a, b) => {
    const diff = tagCount(b.tags) - tagCount(a.tags);
    if (diff !== 0) return diff;
    return a.updatedAt.localeCompare(b.updatedAt);
  });
  return pool[0]?.id ?? null;
}

export const mostTaggedNotePlugin: PluginManifest = {
  id: 'dripnex-most-tagged-note',
  name: 'Most-Tagged Note',
  version: '1.0.0',
  description: 'Open the note with the most tags',

  activate(context) {
    const open = async () => {
      const notes = await context.app.listNotes();
      const id = mostTaggedNoteId(notes, context.app.getCurrentNote()?.id ?? null);
      if (!id) {
        context.notifications.addInfo('No tagged notes');
        return false;
      }
      await context.dispatchCommand('app:open-note', { noteId: id });
      return true;
    };

    const unregister = context.registerCommand(
      { id: 'open', name: 'Open Most-Tagged Note', icon: 'Hash' },
      () => void open()
    );

    return {
      dispose() {
        unregister();
      },
    };
  },
};
