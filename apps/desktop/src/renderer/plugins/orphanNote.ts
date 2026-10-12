import type { PluginManifest } from '@dripnex/plugin-api';

const TEMPLATES = 'templates';

/** Least-recently updated note with no incoming links. Outgoing links still count. Templates and the current note stay out. */
export function orphanNoteId(
  notes: ReadonlyArray<{ id: string; notebookId: string; updatedAt: string }>,
  edges: ReadonlyArray<{ source: string; target: string }>,
  exclude?: string | null
): string | null {
  const incoming = new Set<string>();
  for (const edge of edges) incoming.add(edge.target);
  const pool = notes.filter(
    note => note.id !== exclude && note.notebookId !== TEMPLATES && !incoming.has(note.id)
  );
  if (pool.length === 0) return null;
  pool.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  return pool[0]?.id ?? null;
}

export const orphanNotePlugin: PluginManifest = {
  id: 'dripnex-orphan-note',
  name: 'Orphan Note',
  version: '1.0.0',
  description: 'Open the oldest note that nothing links to',

  activate(context) {
    const open = async () => {
      const [notes, graph] = await Promise.all([
        context.app.listNotes(),
        context.data.getGraphData(),
      ]);
      const id = orphanNoteId(notes, graph.edges, context.app.getCurrentNote()?.id ?? null);
      if (!id) {
        context.notifications.addInfo('No orphan notes');
        return false;
      }
      await context.dispatchCommand('app:open-note', { noteId: id });
      return true;
    };

    const unregister = context.registerCommand(
      { id: 'open', name: 'Open Orphan Note', icon: 'FileText' },
      () => void open()
    );

    return {
      dispose() {
        unregister();
      },
    };
  },
};
