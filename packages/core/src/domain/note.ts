/**
 * Note Entity - The core domain object
 *
 * INVARIANT: Markdown text is the source of truth
 * The Note entity wraps raw markdown with computed metadata
 */

import type { NoteId, Tag, Timestamp } from './types.js';
import { createTimestamp, generateNoteId } from './types.js';
import { extractTitle, extractTags, countWords, type NoteMetadata } from './metadata.js';

/** The Note entity - immutable by design */
export interface Note {
  /** Unique identifier */
  readonly id: NoteId;

  /** Raw markdown content - NEVER auto-modified */
  readonly content: string;

  /** Computed metadata derived from content */
  readonly metadata: NoteMetadata;
}

/** Options for creating a new note */
export interface CreateNoteOptions {
  /** Optional ID (generated if not provided) */
  id?: NoteId;

  /** Markdown content */
  content: string;

  /** Optional creation timestamp (defaults to now) */
  createdAt?: Timestamp;
}

/** Creates a new Note from markdown content */
export function createNote(options: CreateNoteOptions): Note {
  const now = createTimestamp();

  const metadata: NoteMetadata = {
    title: extractTitle(options.content),
    createdAt: options.createdAt ?? now,
    updatedAt: now,
    tags: extractTags(options.content),
    wordCount: countWords(options.content),
    archivedAt: null,
  };

  return {
    id: options.id ?? generateNoteId(),
    content: options.content,
    metadata,
  };
}

/** Updates a note's content, preserving id, createdAt, and archivedAt */
export function updateNoteContent(note: Note, newContent: string): Note {
  const now = createTimestamp();

  const metadata: NoteMetadata = {
    title: extractTitle(newContent),
    createdAt: note.metadata.createdAt,
    updatedAt: now,
    tags: extractTags(newContent),
    wordCount: countWords(newContent),
    archivedAt: note.metadata.archivedAt,
  };

  return {
    id: note.id,
    content: newContent,
    metadata,
  };
}

/** Archives a note (soft delete) */
export function archiveNote(note: Note): Note {
  const now = createTimestamp();

  return {
    ...note,
    metadata: {
      ...note.metadata,
      archivedAt: now,
      updatedAt: now,
    },
  };
}

/** Restores an archived note */
export function restoreNote(note: Note): Note {
  const now = createTimestamp();

  return {
    ...note,
    metadata: {
      ...note.metadata,
      archivedAt: null,
      updatedAt: now,
    },
  };
}

/** Duplicates a note with a new ID */
export function duplicateNote(note: Note): Note {
  const now = createTimestamp();

  return {
    id: generateNoteId(),
    content: note.content,
    metadata: {
      ...note.metadata,
      title: `${note.metadata.title} (copy)`,
      createdAt: now,
      updatedAt: now,
      archivedAt: null, // Duplicates are never archived
    },
  };
}

/** Checks if a note is archived */
export function isArchived(note: Note): boolean {
  return note.metadata.archivedAt !== null;
}

/** Checks if a note contains a specific tag */
export function hasTag(note: Note, tag: Tag): boolean {
  return note.metadata.tags.includes(tag);
}

/** Gets all unique tags from multiple notes */
export function collectTags(notes: readonly Note[]): Tag[] {
  const tags = new Set<Tag>();
  for (const note of notes) {
    for (const tag of note.metadata.tags) {
      tags.add(tag);
    }
  }
  return Array.from(tags);
}
