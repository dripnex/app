import type { PluginManifest } from '@dripnex/plugin-api';

export function pickRandomId(ids: readonly string[], exclude?: string | null): string | null {
  const pool = ids.filter(id => id !== exclude);
  if (pool.length === 0) return null;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? null;
}

export const randomNotePlugin: PluginManifest = {
  id: 'dripnex-random-note',
  name: 'Random Note',
  version: '1.0.0',
  description: 'Open a random note from the library',

  activate(context) {
    const openRandom = async () => {
      const notes = await context.app.listNotes();
      const current = context.app.getCurrentNote()?.id ?? null;
      const id = pickRandomId(
        notes.map(n => n.id),
        current
      );
      if (!id) {
        context.notifications.addInfo('No other notes to open');
        return false;
      }
      await context.dispatchCommand('app:open-note', { noteId: id });
      return true;
    };

    const unregister = context.registerCommand(
      { id: 'open', name: 'Open Random Note', icon: 'Shuffle' },
      () => void openRandom()
    );

    return {
      dispose() {
        unregister();
      },
    };
  },
};
