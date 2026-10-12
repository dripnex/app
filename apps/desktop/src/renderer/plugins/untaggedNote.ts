import type { PluginManifest } from '@dripnex/plugin-api';

const TEMPLATES = 'templates';

function hasTag(tags: readonly string[]): boolean {
  return tags.some(tag => tag.trim().length > 0);
}

/** Least-recently updated note with no tags. Templates and the current note stay out. */
export function untaggedNoteId(
  notes: ReadonlyArray<{
    id: string;
    notebookId: string;
    updatedAt: string;
    tags: readonly string[];
  }>,
  exclude?: string | null
): string | null {
  const pool = notes.filter(
    note => note.id !== exclude && note.notebookId !== TEMPLATES && !hasTag(note.tags)
  );
  if (pool.length === 0) return null;
  pool.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  return pool[0]?.id ?? null;
}

export const untaggedNotePlugin: PluginManifest = {
  id: 'dripnex-untagged-note',
  name: 'Untagged Note',
  version: '1.0.0',
  description: 'Open the oldest note that has no tags',

  activate(context) {
    const open = async () => {
      const notes = await context.app.listNotes();
      const id = untaggedNoteId(notes, context.app.getCurrentNote()?.id ?? null);
      if (!id) {
        context.notifications.addInfo('No untagged notes');
        return false;
      }
      await context.dispatchCommand('app:open-note', { noteId: id });
      return true;
    };

    const unregister = context.registerCommand(
      { id: 'open', name: 'Open Untagged Note', icon: 'Hash' },
      () => void open()
    );

    return {
      dispose() {
        unregister();
      },
    };
  },
};
