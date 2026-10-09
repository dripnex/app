import type { PluginManifest } from '@dripnex/plugin-api';

const TEMPLATES = 'templates';

function titleKey(title: string): string {
  return title.trim().toLowerCase();
}

/** Least-recently updated note whose title is used more than once. Templates and the current note stay out. */
export function duplicateTitleId(
  notes: ReadonlyArray<{ id: string; notebookId: string; title: string; updatedAt: string }>,
  exclude?: string | null
): string | null {
  const counts = new Map<string, number>();
  for (const note of notes) {
    if (note.notebookId === TEMPLATES) continue;
    const key = titleKey(note.title);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const pool = notes.filter(
    note =>
      note.id !== exclude &&
      note.notebookId !== TEMPLATES &&
      (counts.get(titleKey(note.title)) ?? 0) > 1
  );
  if (pool.length === 0) return null;
  pool.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  return pool[0]?.id ?? null;
}

export const duplicateTitlePlugin: PluginManifest = {
  id: 'dripnex-duplicate-title',
  name: 'Duplicate Title',
  version: '1.0.0',
  description: 'Open the oldest note whose title is used more than once',

  activate(context) {
    const open = async () => {
      const notes = await context.app.listNotes();
      const id = duplicateTitleId(notes, context.app.getCurrentNote()?.id ?? null);
      if (!id) {
        context.notifications.addInfo('No duplicate titles');
        return false;
      }
      await context.dispatchCommand('app:open-note', { noteId: id });
      return true;
    };

    const unregister = context.registerCommand(
      { id: 'open', name: 'Open Duplicate Title', icon: 'Copy' },
      () => void open()
    );

    return {
      dispose() {
        unregister();
      },
    };
  },
};
