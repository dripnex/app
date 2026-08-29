import type { PluginManifest } from '@dripnex/plugin-api';

const TEMPLATES = 'templates';

function outgoingCounts(edges: ReadonlyArray<{ source: string }>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
  }
  return counts;
}

/** Note with the most outgoing links. Ties go to the oldest. Templates and the current note stay out. */
export function spokeNoteId(
  notes: ReadonlyArray<{ id: string; notebookId: string; updatedAt: string }>,
  edges: ReadonlyArray<{ source: string; target: string }>,
  exclude?: string | null
): string | null {
  const outgoing = outgoingCounts(edges);
  const pool = notes.filter(
    note => note.id !== exclude && note.notebookId !== TEMPLATES && (outgoing.get(note.id) ?? 0) > 0
  );
  if (pool.length === 0) return null;
  pool.sort((a, b) => {
    const diff = (outgoing.get(b.id) ?? 0) - (outgoing.get(a.id) ?? 0);
    if (diff !== 0) return diff;
    return a.updatedAt.localeCompare(b.updatedAt);
  });
  return pool[0]?.id ?? null;
}

export const spokeNotePlugin: PluginManifest = {
  id: 'dripnex-spoke-note',
  name: 'Spoke Note',
  version: '1.0.0',
  description: 'Open the note that links out to the most other notes',

  activate(context) {
    const open = async () => {
      const [notes, graph] = await Promise.all([
        context.app.listNotes(),
        context.data.getGraphData(),
      ]);
      const id = spokeNoteId(notes, graph.edges, context.app.getCurrentNote()?.id ?? null);
      if (!id) {
        context.notifications.addInfo('No spoke notes');
        return false;
      }
      await context.dispatchCommand('app:open-note', { noteId: id });
      return true;
    };

    const unregister = context.registerCommand(
      { id: 'open', name: 'Open Spoke Note', icon: 'Share2' },
      () => void open()
    );

    return {
      dispose() {
        unregister();
      },
    };
  },
};
