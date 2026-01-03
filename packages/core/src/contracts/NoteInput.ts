/**
 * NoteInput - Data Transfer Object for creating/updating notes
 *
 * This is what enters the core from the UI/external world
 */

import type { NoteId } from '../domain/types.js';

/** Input for creating a new note */
export interface CreateNoteInput {
  /** Markdown content */
  content: string;

  /** Optional ID (auto-generated if not provided) */
  id?: string;

  /** Optional notebook ID (defaults to Inbox) */
  notebookId?: string;
}

/** Input for updating an existing note's content */
export interface UpdateNoteInput {
  /** ID of the note to update */
  id: NoteId;

  /** New markdown content */
  content: string;
}

/** Input for updating an existing note's title */
export interface UpdateTitleInput {
  /** ID of the note to update */
  id: NoteId;

  /** New title (structural, independent from content) */
  title: string;
}

/** Input for deleting a note */
export interface DeleteNoteInput {
  /** ID of the note to delete */
  id: NoteId;
}

/** Input for getting a note by ID */
export interface GetNoteInput {
  /** ID of the note to retrieve */
  id: NoteId;
}
