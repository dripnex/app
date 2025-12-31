/**
 * ExtendedNoteRepository Interface
 *
 * Extends the minimal NoteRepository from @readied/core with
 * query capabilities (list, search, count, tags).
 */

import type { Note, Tag, NoteRepository } from '@readied/core';
import type { ListNotesOptions } from '../types/ListNotesOptions.js';

/**
 * Extended repository interface with query capabilities.
 * Extends the minimal NoteRepository from @readied/core.
 */
export interface ExtendedNoteRepository extends NoteRepository {
  /** List notes with filtering and pagination */
  list(options?: ListNotesOptions): Promise<Note[]>;

  /** Search notes by content/title */
  search(query: string, limit?: number, includeArchived?: boolean): Promise<Note[]>;

  /** Get total count of notes */
  count(includeArchived?: boolean): Promise<number>;

  /** Get count of archived notes */
  countArchived(): Promise<number>;

  /** Get all unique tags */
  getAllTags(includeArchived?: boolean): Promise<Tag[]>;
}
