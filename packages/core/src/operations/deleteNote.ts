/**
 * DeleteNote Operation
 *
 * Deletes a note by ID
 */

import type { NoteId } from '../domain/types.js';
import { success, notFound, type Result } from '../contracts/CoreResult.js';
import type { DeleteNoteInput } from '../contracts/NoteInput.js';
import type { NoteRepository } from '../repositories/NoteRepository.js';

/** Deletes a note by ID */
export async function deleteNoteOperation(
  input: DeleteNoteInput,
  repository: NoteRepository
): Promise<Result<void>> {
  // Check if note exists
  const existing = await repository.get(input.id);
  if (!existing) {
    return notFound(input.id);
  }

  // Delete from repository
  await repository.delete(input.id);

  return success(undefined);
}
