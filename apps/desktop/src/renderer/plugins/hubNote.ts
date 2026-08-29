import type { PluginManifest } from '@dripnex/plugin-api';

const TEMPLATES = 'templates';

function incomingCounts(edges: ReadonlyArray<{ target: string }>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
  }
  return counts;
}

/** Note with the most incoming links. Ties go to the oldest. Templates and the current note stay out. */
export function hubNoteId(
  notes: ReadonlyArray<{ id: string; notebookId: string; updatedAt: string }>,
  edges: ReadonlyArray<{ source: string; target: string }>,
  exclude?: string | null
): string | null {
  const incoming = incomingCounts(edges);
  const pool = notes.filter(
    note => note.id !== exclude && note.notebookId !== TEMPLATES && (incoming.get(note.id) ?? 0) > 0
  );
  if (pool.length === 0) return null;
  pool.sort((a, b) => {
    const diff = (incoming.get(b.id) ?? 0) - (incoming.get(a.id) ?? 0);
    if (diff !== 0) return diff;
    return a.updatedAt.localeCompare(b.updatedAt);
  });
  return pool[0]?.id ?? null;
}

export const hubNotePlugin: PluginManifest = {
  id: 'dripnex-hub-note',
  name: 'Hub Note',
  version: '1.0.0',
  description: 'Open the note that the most other notes link to',

  activate(context) {
    const open = async () => {
      const [notes, graph] = await Promise.all([
        context.app.listNotes(),
        context.data.getGraphData(),
      ]);
      const id = hubNoteId(notes, graph.edges, context.app.getCurrentNote()?.id ?? null);
      if (!id) {
        context.notifications.addInfo('No hub notes');
        return false;
      }
      await context.dispatchCommand('app:open-note', { noteId: id });
      return true;
    };

    const unregister = context.registerCommand(
      { id: 'open', name: 'Open Hub Note', icon: 'Share2' },
      () => void open()
    );

    return {
      dispose() {
        unregister();
      },
    };
  },
};
