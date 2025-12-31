/**
 * ArchiveNote Operation
 *
 * Soft deletes a note by setting archivedAt timestamp
 */

import { archiveNote as archiveNoteFn, isArchived } from '../domain/note.js';
import type { NoteId } from '../domain/types.js';
import { success, notFound, type Result, failure } from '../contracts/CoreResult.js';
import { toSnapshot, type NoteSnapshot } from '../contracts/NoteSnapshot.js';
import type { NoteRepository } from '../repositories/NoteRepository.js';

/** Input for archiving a note */
export interface ArchiveNoteInput {
  id: NoteId;
}

/** Archives a note (soft delete) */
export async function archiveNoteOperation(
  input: ArchiveNoteInput,
  repository: NoteRepository
): Promise<Result<NoteSnapshot>> {
  // Get existing note
  const existing = await repository.get(input.id);
  if (!existing) {
    return notFound(input.id);
  }

  // Check if already archived
  if (isArchived(existing)) {
    return failure({
      type: 'VALIDATION_ERROR',
      error: { type: 'INVALID_CONTENT', reason: 'Note is already archived' },
    });
  }

  // Archive the note
  const archived = archiveNoteFn(existing);

  // Save to repository
  await repository.save(archived);

  return success(toSnapshot(archived));
}
