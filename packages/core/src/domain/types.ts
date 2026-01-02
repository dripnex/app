/**
 * Core domain types for Readied
 * These are the fundamental building blocks of the note system
 */

/** Branded type for Note IDs to prevent mixing with plain strings */
export type NoteId = string & { readonly __brand: 'NoteId' };

/** Creates a new NoteId from a string */
export function createNoteId(id: string): NoteId {
  return id as NoteId;
}

/** Generates a new unique NoteId */
export function generateNoteId(): NoteId {
  // crypto is available in Node.js 19+, Electron, and all modern browsers
  const cryptoModule = (globalThis as unknown as { crypto: { randomUUID(): string } }).crypto;
  return cryptoModule.randomUUID() as NoteId;
}

/** ISO 8601 timestamp string */
export type Timestamp = string & { readonly __brand: 'Timestamp' };

/** Creates a Timestamp from a Date or uses current time */
export function createTimestamp(date?: Date): Timestamp {
  return (date ?? new Date()).toISOString() as Timestamp;
}

/** Tag extracted from note content (e.g., #javascript) */
export type Tag = string & { readonly __brand: 'Tag' };

/** Creates a Tag, normalizing to lowercase without the # prefix */
export function createTag(raw: string): Tag {
  const normalized = raw.replace(/^#/, '').toLowerCase().trim();
  return normalized as Tag;
}

/** Branded type for Notebook IDs to prevent mixing with plain strings */
export type NotebookId = string & { readonly __brand: 'NotebookId' };

/** Creates a new NotebookId from a string */
export function createNotebookId(id: string): NotebookId {
  return id as NotebookId;
}

/** Generates a new unique NotebookId */
export function generateNotebookId(): NotebookId {
  const cryptoModule = (globalThis as unknown as { crypto: { randomUUID(): string } }).crypto;
  return cryptoModule.randomUUID() as NotebookId;
}

/** Special Inbox notebook ID - all notes without a notebook go here */
export const INBOX_NOTEBOOK_ID = createNotebookId('inbox');

/** Maximum allowed nesting depth for notebooks (0, 1, 2 = 3 levels) */
export const MAX_NOTEBOOK_DEPTH = 2;

/** Status of a note for workflow tracking */
export type NoteStatus = 'active' | 'on_hold' | 'completed' | 'dropped';

/** All valid note statuses */
export const NOTE_STATUSES: readonly NoteStatus[] = ['active', 'on_hold', 'completed', 'dropped'] as const;

/** Default status for new notes */
export const DEFAULT_NOTE_STATUS: NoteStatus = 'active';
