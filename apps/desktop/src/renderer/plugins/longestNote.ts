import type { PluginManifest } from '@dripnex/plugin-api';
import { isDailyTitle } from './stubNote';

const TEMPLATES = 'templates';

/** Highest word count. Ties go to the oldest. Templates, daily titles, and the current note stay out. */
export function longestNoteId(
  notes: ReadonlyArray<{
    id: string;
    notebookId: string;
    title: string;
    updatedAt: string;
    wordCount: number;
  }>,
  exclude?: string | null
): string | null {
  const pool = notes.filter(
    note =>
      note.id !== exclude &&
      note.notebookId !== TEMPLATES &&
      note.wordCount > 0 &&
      !isDailyTitle(note.title)
  );
  if (pool.length === 0) return null;
  pool.sort((a, b) => {
    const diff = b.wordCount - a.wordCount;
    if (diff !== 0) return diff;
    return a.updatedAt.localeCompare(b.updatedAt);
  });
  return pool[0]?.id ?? null;
}

export const longestNotePlugin: PluginManifest = {
  id: 'dripnex-longest-note',
  name: 'Longest Note',
  version: '1.0.0',
  description: 'Open the note with the most words',

  activate(context) {
    const open = async () => {
      const notes = await context.app.listNotes();
      const id = longestNoteId(notes, context.app.getCurrentNote()?.id ?? null);
      if (!id) {
        context.notifications.addInfo('No long notes');
        return false;
      }
      await context.dispatchCommand('app:open-note', { noteId: id });
      return true;
    };

    const unregister = context.registerCommand(
      { id: 'open', name: 'Open Longest Note', icon: 'FileText' },
      () => void open()
    );

    return {
      dispose() {
        unregister();
      },
    };
  },
};
