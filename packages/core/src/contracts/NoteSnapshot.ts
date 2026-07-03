/**
 * NoteSnapshot - Read-only view of a Note for the UI
 *
 * This is what exits the core to the external world
 */

import type { Note } from '../domain/note.js';
import type {
  NoteId,
  Tag,
  Timestamp,
  NoteStatus,
  BoardStage,
  NotePriority,
} from '../domain/types.js';

/** A read-only snapshot of a note for the UI */
export interface NoteSnapshot {
  readonly id: NoteId;
  readonly notebookId: string;
  readonly content: string;
  readonly title: string;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly tags: readonly Tag[];
  readonly wordCount: number;
  readonly archivedAt: Timestamp | null;
  readonly isArchived: boolean;
  readonly isPinned: boolean;
  readonly isDeleted: boolean;
  readonly status: NoteStatus;
  readonly boardStage: BoardStage | null;
  readonly priority: NotePriority;
  readonly boardOrder: number;
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
    tags: note.metadata.tags,
    wordCount: note.metadata.wordCount,
    archivedAt: note.metadata.archivedAt,
    isArchived: note.metadata.archivedAt !== null,
    isPinned: note.isPinned,
    isDeleted: note.isDeleted,
    status: note.status,
    boardStage: note.boardStage,
    priority: note.priority,
    boardOrder: note.boardOrder,
  };
}

/** A summary of a note (without full content) for list views */
export interface NoteSummary {
  readonly id: NoteId;
  readonly notebookId: string;
  readonly title: string;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly tags: readonly Tag[];
  readonly wordCount: number;
  /** First ~200 chars of content for preview */
  readonly excerpt: string;
  readonly archivedAt: Timestamp | null;
  readonly isArchived: boolean;
  readonly isPinned: boolean;
  readonly isDeleted: boolean;
  readonly status: NoteStatus;
  readonly boardStage: BoardStage | null;
  readonly priority: NotePriority;
  readonly boardOrder: number;
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
    tags: note.metadata.tags,
    wordCount: note.metadata.wordCount,
    excerpt: excerpt + (note.content.length > excerptLength ? '...' : ''),
    archivedAt: note.metadata.archivedAt,
    isArchived: note.metadata.archivedAt !== null,
    isPinned: note.isPinned,
    isDeleted: note.isDeleted,
    status: note.status,
    boardStage: note.boardStage,
    priority: note.priority,
    boardOrder: note.boardOrder,
  };
}
