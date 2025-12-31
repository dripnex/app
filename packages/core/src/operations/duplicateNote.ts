/**
 * DuplicateNote Operation
 *
 * Creates a copy of an existing note with a new ID
 */

import { duplicateNote as duplicateNoteFn } from '../domain/note.js';
import type { NoteId } from '../domain/types.js';
import { success, notFound, type Result } from '../contracts/CoreResult.js';
import { toSnapshot, type NoteSnapshot } from '../contracts/NoteSnapshot.js';
import type { NoteRepository } from './createNote.js';

/** Input for duplicating a note */
export interface DuplicateNoteInput {
  id: NoteId;
}

/** Duplicates a note */
export async function duplicateNoteOperation(
  input: DuplicateNoteInput,
  repository: NoteRepository
): Promise<Result<NoteSnapshot>> {
  // Get existing note
  const existing = await repository.get(input.id);
  if (!existing) {
    return notFound(input.id);
  }

  // Duplicate the note
  const duplicated = duplicateNoteFn(existing);

  // Save to repository
  await repository.save(duplicated);

  return success(toSnapshot(duplicated));
}
