import type { PluginManifest } from '@dripnex/plugin-api';
import { isDailyTitle } from './stubNote';

const TEMPLATES = 'templates';

/** Most-recently updated note. Templates, daily titles, and the current note stay out. */
export function newestNoteId(
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
  pool.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return pool[0]?.id ?? null;
}

export const newestNotePlugin: PluginManifest = {
  id: 'dripnex-newest-note',
  name: 'Newest Note',
  version: '1.0.0',
  description: 'Open the note that was edited most recently',

  activate(context) {
    const open = async () => {
      const notes = await context.app.listNotes();
      const id = newestNoteId(notes, context.app.getCurrentNote()?.id ?? null);
      if (!id) {
        context.notifications.addInfo('No recent notes');
        return false;
      }
      await context.dispatchCommand('app:open-note', { noteId: id });
      return true;
    };

    const unregister = context.registerCommand(
      { id: 'open', name: 'Open Newest Note', icon: 'FileText' },
      () => void open()
    );

    return {
      dispose() {
        unregister();
      },
    };
  },
};
