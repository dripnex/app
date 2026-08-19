import type { Conflict } from '../stores/syncStore';
import { conflictNoteTitle, remoteCopyTitle } from './conflictCopy';

export interface OpenBothNote {
  id: string;
  notebookId?: string;
}

export interface OpenBothDeps {
  getNote: (id: string) => Promise<{ ok: true; data: OpenBothNote } | { ok: false }>;
  createNote: (input: {
    content: string;
    notebookId?: string;
  }) => Promise<{ ok: true; data: OpenBothNote } | { ok: false }>;
  updateTitle: (input: { id: string; title: string }) => Promise<{ ok: boolean }>;
  openNote: (id: string, title: string) => Promise<unknown>;
  resolveLocal: (noteId: string) => Promise<void>;
}

/** Keep this device, save the other version as `{title} (remote)`, open both. */
export async function openBothConflict(
  conflict: Conflict,
  deps: OpenBothDeps
): Promise<{ remoteNoteId: string; remoteTitle: string }> {
  const localTitle = conflictNoteTitle(conflict.localContent);
  const copyTitle = remoteCopyTitle(localTitle);

  const existing = await deps.getNote(conflict.noteId);
  const notebookId = existing.ok ? existing.data.notebookId : undefined;

  const created = await deps.createNote({
    content: conflict.remoteContent,
    notebookId,
  });
  if (!created.ok) {
    throw new Error('Could not save the other version as a new note.');
  }

  const renamed = await deps.updateTitle({ id: created.data.id, title: copyTitle });
  if (!renamed.ok) {
    throw new Error('Could not rename the other version.');
  }
  await deps.resolveLocal(conflict.noteId);
  await deps.openNote(conflict.noteId, localTitle);
  await deps.openNote(created.data.id, copyTitle);

  return { remoteNoteId: created.data.id, remoteTitle: copyTitle };
}
