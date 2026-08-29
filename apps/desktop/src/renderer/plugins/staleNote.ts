import type { PluginManifest } from '@dripnex/plugin-api';
import { isDailyTitle } from './stubNote';

const TEMPLATES = 'templates';

/** Least-recently updated note, regardless of length. Templates, daily titles, and the current note stay out. */
export function staleNoteId(
  notes: ReadonlyArray<{
    id: string;
    notebookId: string;
    title: string;
    updatedAt: string;
  }>,
  exclude?: string | null
): string | null {
  const pool = notes.filter(
    note => note.id !== exclude && note.notebookId !== TEMPLATES && !isDailyTitle(note.title)
  );
  if (pool.length === 0) return null;
  pool.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  return pool[0]?.id ?? null;
}

export const staleNotePlugin: PluginManifest = {
  id: 'dripnex-stale-note',
  name: 'Stale Note',
  version: '1.0.0',
  description: 'Open the note that has gone the longest without an edit',

  activate(context) {
    const open = async () => {
      const notes = await context.app.listNotes();
      const id = staleNoteId(notes, context.app.getCurrentNote()?.id ?? null);
      if (!id) {
        context.notifications.addInfo('No stale notes');
        return false;
      }
      await context.dispatchCommand('app:open-note', { noteId: id });
      return true;
    };

    const unregister = context.registerCommand(
      { id: 'open', name: 'Open Stale Note', icon: 'FileText' },
      () => void open()
    );

    return {
      dispose() {
        unregister();
      },
    };
  },
};
