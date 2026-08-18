/**
 * NoteSnapshot - Read-only view of a Note for the UI
 *
 * This is what exits the core to the external world
 */

import type { Note } from '../domain/note.js';
import type { NoteStatus } from '../domain/types.js';

/**
 * Wire/UI snapshot of a note.
 *
 * Plain serializable fields (no branded ids) so IPC, preload, and storage
 * share one contract. The Note entity keeps brands internally.
 */
export interface NoteSnapshot {
  readonly id: string;
  readonly notebookId: string;
  readonly content: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly tags: string[];
  readonly wordCount: number;
  readonly archivedAt: string | null;
  readonly isArchived: boolean;
  readonly isPinned: boolean;
  readonly isDeleted: boolean;
  readonly status: NoteStatus;
}

/** Converts a Note entity to a NoteSnapshot */
export function toSnapshot(note: Note): NoteSnapshot {
  return {
    id: note.id,
    notebookId: note.notebookId,
    content: note.content,
    title: note.title, // Use structural title
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

/** A summary of a note (without full content) for list views */
export interface NoteSummary {
  readonly id: string;
  readonly notebookId: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly tags: string[];
  readonly wordCount: number;
  /** First ~200 chars of content for preview */
  readonly excerpt: string;
  readonly archivedAt: string | null;
  readonly isArchived: boolean;
  readonly isPinned: boolean;
  readonly isDeleted: boolean;
  readonly status: NoteStatus;
}

/** Converts a Note to a NoteSummary */
export function toSummary(note: Note, excerptLength: number = 200): NoteSummary {
  const excerpt = note.content
    .replace(/^#.*$/m, '') // Remove title heading if present
    .trim()
    .slice(0, excerptLength);

  return {
    id: note.id,
    notebookId: note.notebookId,
    title: note.title, // Use structural title
    createdAt: note.metadata.createdAt,
    updatedAt: note.metadata.updatedAt,
    tags: [...note.metadata.tags],
    wordCount: note.metadata.wordCount,
    excerpt: excerpt + (note.content.length > excerptLength ? '...' : ''),
    archivedAt: note.metadata.archivedAt,
    isArchived: note.metadata.archivedAt !== null,
    isPinned: note.isPinned,
    isDeleted: note.isDeleted,
    status: note.status,
  };
}
