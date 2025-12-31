/**
 * NoteSnapshot - Read-only view of a Note for the UI
 *
 * This is what exits the core to the external world
 */

import type { Note } from '../domain/note.js';
import type { NoteId, Tag, Timestamp } from '../domain/types.js';

/** A read-only snapshot of a note for the UI */
export interface NoteSnapshot {
  readonly id: NoteId;
  readonly content: string;
  readonly title: string;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly tags: readonly Tag[];
  readonly wordCount: number;
  readonly archivedAt: Timestamp | null;
  readonly isArchived: boolean;
}

/** Converts a Note entity to a NoteSnapshot */
export function toSnapshot(note: Note): NoteSnapshot {
  return {
    id: note.id,
    content: note.content,
    title: note.metadata.title,
    createdAt: note.metadata.createdAt,
    updatedAt: note.metadata.updatedAt,
    tags: note.metadata.tags,
    wordCount: note.metadata.wordCount,
    archivedAt: note.metadata.archivedAt,
    isArchived: note.metadata.archivedAt !== null,
  };
}

/** A summary of a note (without full content) for list views */
export interface NoteSummary {
  readonly id: NoteId;
  readonly title: string;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly tags: readonly Tag[];
  readonly wordCount: number;
  /** First ~200 chars of content for preview */
  readonly excerpt: string;
  readonly archivedAt: Timestamp | null;
  readonly isArchived: boolean;
}

/** Converts a Note to a NoteSummary */
export function toSummary(note: Note, excerptLength: number = 200): NoteSummary {
  const excerpt = note.content
    .replace(/^#.*$/m, '') // Remove title
    .trim()
    .slice(0, excerptLength);

  return {
    id: note.id,
    title: note.metadata.title,
    createdAt: note.metadata.createdAt,
    updatedAt: note.metadata.updatedAt,
    tags: note.metadata.tags,
    wordCount: note.metadata.wordCount,
    excerpt: excerpt + (note.content.length > excerptLength ? '...' : ''),
    archivedAt: note.metadata.archivedAt,
    isArchived: note.metadata.archivedAt !== null,
  };
}
