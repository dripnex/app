/**
 * Core domain types for Dripnex
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

/** Special Planning notebook ID - notes here appear as cards on the Kanban board */
export const PLANNING_NOTEBOOK_ID = createNotebookId('planning');

/** Maximum allowed nesting depth for notebooks (0, 1, 2 = 3 levels) */
export const MAX_NOTEBOOK_DEPTH = 2;

/** Status of a note for workflow tracking */
export type NoteStatus = 'active' | 'on_hold' | 'completed' | 'dropped';

/** All valid note statuses */
export const NOTE_STATUSES: readonly NoteStatus[] = [
  'active',
  'on_hold',
  'completed',
  'dropped',
] as const;

/** Default status for new notes */
export const DEFAULT_NOTE_STATUS: NoteStatus = 'active';

/** All valid board stages, in column order (single source of truth) */
export const BOARD_STAGES = ['backlog', 'todo', 'in_progress', 'in_review', 'in_staging'] as const;

/**
 * Kanban board stage for planning notes.
 * Independent from NoteStatus: this is the column a note occupies on the
 * Planning board. Only notes on the board carry a stage (others are null).
 */
export type BoardStage = (typeof BOARD_STAGES)[number];

/** Default stage for a note that enters the board */
export const DEFAULT_BOARD_STAGE: BoardStage = 'backlog';

/** All valid note priorities, low→high (single source of truth) */
export const NOTE_PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent'] as const;

/** Priority of a note (Linear-style), used to sort/flag work on the board */
export type NotePriority = (typeof NOTE_PRIORITIES)[number];

/** Default priority for new notes */
export const DEFAULT_NOTE_PRIORITY: NotePriority = 'none';
