/**
 * Note Entity - The core domain object
 *
 * INVARIANT: Markdown text is the source of truth
 * The Note entity wraps raw markdown with computed metadata
 */

import type { NoteId, NotebookId, Tag, Timestamp } from './types.js';
import { createTimestamp, generateNoteId, INBOX_NOTEBOOK_ID } from './types.js';
import { extractTitle, extractTags, countWords, type NoteMetadata } from './metadata.js';

/** The Note entity - immutable by design */
export interface Note {
  /** Unique identifier */
  readonly id: NoteId;

  /** Notebook this note belongs to (defaults to Inbox) */
  readonly notebookId: NotebookId;

  /** Raw markdown content - NEVER auto-modified */
  readonly content: string;

  /** Computed metadata derived from content */
  readonly metadata: NoteMetadata;
}

/** Options for creating a new note */
export interface CreateNoteOptions {
  /** Optional ID (generated if not provided) */
  id?: NoteId;

  /** Notebook to place note in (defaults to Inbox) */
  notebookId?: NotebookId;

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
    notebookId: options.notebookId ?? INBOX_NOTEBOOK_ID,
    content: options.content,
    metadata,
  };
}

/** Updates a note's content, preserving id, notebookId, createdAt, and archivedAt */
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
    notebookId: note.notebookId,
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

/** Duplicates a note with a new ID (in same notebook) */
export function duplicateNote(note: Note): Note {
  const now = createTimestamp();

  return {
    id: generateNoteId(),
    notebookId: note.notebookId,
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

/** Moves a note to a different notebook */
export function moveNoteToNotebook(note: Note, notebookId: NotebookId): Note {
  const now = createTimestamp();

  return {
    ...note,
    notebookId,
    metadata: {
      ...note.metadata,
      updatedAt: now,
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
