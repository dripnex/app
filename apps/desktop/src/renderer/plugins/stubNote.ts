import type { PluginManifest } from '@dripnex/plugin-api';

const TEMPLATES = 'templates';
const DAILY_TITLE = /^\d{4}-\d{2}-\d{2}$/;

/** Title-only / thin notes. Daily notes are skipped — their body is just the date heading. */
export const STUB_WORD_LIMIT = 12;

export function isDailyTitle(title: string): boolean {
  return DAILY_TITLE.test(title.trim());
}

/** Least-recently updated thin note. Templates, daily titles, and the current note stay out. */
export function stubNoteId(
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
      note.wordCount <= STUB_WORD_LIMIT &&
      !isDailyTitle(note.title)
  );
  if (pool.length === 0) return null;
  pool.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  return pool[0]?.id ?? null;
}

export const stubNotePlugin: PluginManifest = {
  id: 'dripnex-stub-note',
  name: 'Stub Note',
  version: '1.0.0',
  description: 'Open the oldest short note that still needs writing',

  activate(context) {
    const open = async () => {
      const notes = await context.app.listNotes();
      const id = stubNoteId(notes, context.app.getCurrentNote()?.id ?? null);
      if (!id) {
        context.notifications.addInfo('No stub notes');
        return false;
      }
      await context.dispatchCommand('app:open-note', { noteId: id });
      return true;
    };

    const unregister = context.registerCommand(
      { id: 'open', name: 'Open Stub Note', icon: 'PenLine' },
      () => void open()
    );

    return {
      dispose() {
        unregister();
      },
    };
  },
};
