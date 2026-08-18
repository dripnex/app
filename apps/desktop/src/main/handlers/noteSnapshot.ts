import type { NoteStatus } from '@dripnex/core';

export function noteToSnapshot(note: {
  id: string;
  notebookId: string;
  content: string;
  title: string;
  isPinned: boolean;
  isDeleted: boolean;
  status: NoteStatus;
  metadata: {
    createdAt: string;
    updatedAt: string;
    tags: readonly string[];
    wordCount: number;
    archivedAt: string | null;
  };
}) {
  return {
    id: note.id,
    notebookId: note.notebookId,
    content: note.content,
    title: note.title,
    createdAt: note.metadata.createdAt,
    updatedAt: note.metadata.updatedAt,
    tags: [...note.metadata.tags],
    wordCount: note.metadata.wordCount,
    archivedAt: note.metadata.archivedAt,
    isArchived: note.metadata.archivedAt !== null,
    isPinned: note.isPinned,
    isDeleted: note.isDeleted,
    status: note.status,
  };
}
