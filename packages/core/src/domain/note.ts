/**
 * Note Entity - The core domain object
 *
 * INVARIANT: Markdown text is the source of truth
 * The Note entity wraps raw markdown with computed metadata
 */

import type { NoteId, NotebookId, Tag, Timestamp, NoteStatus } from './types.js';
import {
  createTimestamp,
  generateNoteId,
  INBOX_NOTEBOOK_ID,
  DEFAULT_NOTE_STATUS,
} from './types.js';
import {
  extractTitle,
  extractTags,
  countWords,
  isPlaceholderTitle,
  type NoteMetadata,
} from './metadata.js';

/** The Note entity - immutable by design */
export interface Note {
  /** Unique identifier */
  readonly id: NoteId;

  /** Notebook this note belongs to (defaults to Inbox) */
  readonly notebookId: NotebookId;

  /** Structural title - editable independently from content */
  readonly title: string;

  /** Raw markdown content - NEVER auto-modified */
  readonly content: string;

  /** Whether the note is pinned to the top */
  readonly isPinned: boolean;

  /** Whether the note is in trash (soft deleted) */
  readonly isDeleted: boolean;

  /** Workflow status of the note */
  readonly status: NoteStatus;

  /** Computed metadata derived from content */
  readonly metadata: NoteMetadata;
}

/** Options for creating a new note */
export interface CreateNoteOptions {
  /** Optional ID (generated if not provided) */
  id?: NoteId;

  /** Notebook to place note in (defaults to Inbox) */
  notebookId?: NotebookId;

  /** Structural title (defaults to extracted from content) */
  title?: string;

  /** Markdown content */
  content: string;

  /** Optional creation timestamp (defaults to now) */
  createdAt?: Timestamp;

  /** Whether the note is pinned (defaults to false) */
  isPinned?: boolean;

  /** Whether the note is in trash (defaults to false) */
  isDeleted?: boolean;

  /** Workflow status (defaults to 'active') */
  status?: NoteStatus;
}

/** Creates a new Note from markdown content */
export function createNote(options: CreateNoteOptions): Note {
  const now = createTimestamp();

  // Title is structural: use provided title or extract from content
  const title = options.title ?? extractTitle(options.content);

  const metadata: NoteMetadata = {
    title, // Keep in sync for backwards compatibility
    createdAt: options.createdAt ?? now,
    updatedAt: now,
    tags: extractTags(options.content),
    wordCount: countWords(options.content),
    archivedAt: null,
  };

  return {
    id: options.id ?? generateNoteId(),
    notebookId: options.notebookId ?? INBOX_NOTEBOOK_ID,
    title,
    content: options.content,
    isPinned: options.isPinned ?? false,
    isDeleted: options.isDeleted ?? false,
    status: options.status ?? DEFAULT_NOTE_STATUS,
    metadata,
  };
}

/** Updates a note's content. A placeholder title adopts the new first heading. */
export function updateNoteContent(note: Note, newContent: string): Note {
  const now = createTimestamp();
  const extracted = extractTitle(newContent);
  const title =
    isPlaceholderTitle(note.title) && !isPlaceholderTitle(extracted) ? extracted : note.title;

  const metadata: NoteMetadata = {
    title,
    createdAt: note.metadata.createdAt,
    updatedAt: now,
    tags: extractTags(newContent),
    wordCount: countWords(newContent),
    archivedAt: note.metadata.archivedAt,
  };

  return {
    id: note.id,
    notebookId: note.notebookId,
    title,
    content: newContent,
    isPinned: note.isPinned,
    isDeleted: note.isDeleted,
    status: note.status,
    metadata,
  };
}

/** Updates a note's title (structural, independent from content) */
export function updateNoteTitle(note: Note, newTitle: string): Note {
  const now = createTimestamp();

  return {
    ...note,
    title: newTitle,
    metadata: {
      ...note.metadata,
      title: newTitle, // Keep in sync for backwards compatibility
      updatedAt: now,
    },
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
  const duplicatedTitle = `${note.title} (copy)`;

  return {
    id: generateNoteId(),
    notebookId: note.notebookId,
    title: duplicatedTitle,
    content: note.content,
    isPinned: false, // Duplicates are never pinned
    isDeleted: false, // Duplicates are never in trash
    status: DEFAULT_NOTE_STATUS, // Reset status to active
    metadata: {
      ...note.metadata,
      title: duplicatedTitle,
      createdAt: now,
      updatedAt: now,
      archivedAt: null, // Duplicates are never archived
    },
  };
}

/** Moves a note to a different notebook (metadata-only, doesn't change updatedAt) */
export function moveNoteToNotebook(note: Note, notebookId: NotebookId): Note {
  return {
    ...note,
    notebookId,
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

/** Pins a note to the top (does not update updatedAt - pin is organizational metadata) */
export function pinNote(note: Note): Note {
  return {
    ...note,
    isPinned: true,
  };
}

/** Unpins a note (does not update updatedAt - pin is organizational metadata) */
export function unpinNote(note: Note): Note {
  return {
    ...note,
    isPinned: false,
  };
}

/** Moves a note to trash (soft delete) */
export function softDeleteNote(note: Note): Note {
  const now = createTimestamp();

  return {
    ...note,
    isDeleted: true,
    isPinned: false, // Unpin when moving to trash
    metadata: {
      ...note.metadata,
      updatedAt: now,
    },
  };
}

/** Restores a note from trash */
export function restoreDeletedNote(note: Note): Note {
  const now = createTimestamp();

  return {
    ...note,
    isDeleted: false,
    metadata: {
      ...note.metadata,
      updatedAt: now,
    },
  };
}

/** Updates a note's workflow status (metadata-only, doesn't change updatedAt) */
export function setNoteStatus(note: Note, status: NoteStatus): Note {
  return {
    ...note,
    status,
  };
}

/** Checks if a note is pinned */
export function isPinned(note: Note): boolean {
  return note.isPinned;
}

/** Checks if a note is in trash */
export function isDeleted(note: Note): boolean {
  return note.isDeleted;
}
