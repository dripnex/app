/**
 * NoteRepository Interface
 *
 * Port for note storage operations (Hexagonal Architecture)
 */

import type { Note } from '../domain/note.js';
import type { NoteId } from '../domain/types.js';

/** Repository interface for note storage (port) */
export interface NoteRepository {
  get(id: NoteId): Promise<Note | null>;
  save(note: Note): Promise<void>;
  delete(id: NoteId): Promise<void>;
}
