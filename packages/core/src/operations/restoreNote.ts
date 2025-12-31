/**
 * RestoreNote Operation
 *
 * Restores an archived note by clearing archivedAt timestamp
 */

import { restoreNote as restoreNoteFn, isArchived } from '../domain/note.js';
import type { NoteId } from '../domain/types.js';
import { success, notFound, type Result, failure } from '../contracts/CoreResult.js';
import { toSnapshot, type NoteSnapshot } from '../contracts/NoteSnapshot.js';
import type { NoteRepository } from '../repositories/NoteRepository.js';

/** Input for restoring a note */
export interface RestoreNoteInput {
  id: NoteId;
}

/** Restores an archived note */
export async function restoreNoteOperation(
  input: RestoreNoteInput,
  repository: NoteRepository
): Promise<Result<NoteSnapshot>> {
  // Get existing note
  const existing = await repository.get(input.id);
  if (!existing) {
    return notFound(input.id);
  }

  // Check if not archived
  if (!isArchived(existing)) {
    return failure({
      type: 'VALIDATION_ERROR',
      error: { type: 'INVALID_CONTENT', reason: 'Note is not archived' },
    });
  }

  // Restore the note
  const restored = restoreNoteFn(existing);

  // Save to repository
  await repository.save(restored);

  return success(toSnapshot(restored));
}
