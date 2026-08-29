import type { PluginManifest } from '@dripnex/plugin-api';

const TEMPLATES = 'templates';

/** Least-recently updated note with no graph edges. Templates and the current note stay out. */
export function unlinkedNoteId(
  notes: ReadonlyArray<{ id: string; notebookId: string; updatedAt: string }>,
  edges: ReadonlyArray<{ source: string; target: string }>,
  exclude?: string | null
): string | null {
  const linked = new Set<string>();
  for (const edge of edges) {
    linked.add(edge.source);
    linked.add(edge.target);
  }
  const pool = notes.filter(
    note => note.id !== exclude && note.notebookId !== TEMPLATES && !linked.has(note.id)
  );
  if (pool.length === 0) return null;
  pool.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  return pool[0]?.id ?? null;
}

export const unlinkedNotePlugin: PluginManifest = {
  id: 'dripnex-unlinked-note',
  name: 'Unlinked Note',
  version: '1.0.0',
  description: 'Open the oldest note that has no wikilinks',

  activate(context) {
    const open = async () => {
      const [notes, graph] = await Promise.all([
        context.app.listNotes(),
        context.data.getGraphData(),
      ]);
      const id = unlinkedNoteId(notes, graph.edges, context.app.getCurrentNote()?.id ?? null);
      if (!id) {
        context.notifications.addInfo('No unlinked notes');
        return false;
      }
      await context.dispatchCommand('app:open-note', { noteId: id });
      return true;
    };

    const unregister = context.registerCommand(
      { id: 'open', name: 'Open Unlinked Note', icon: 'Unlink' },
      () => void open()
    );

    return {
      dispose() {
        unregister();
      },
    };
  },
};
