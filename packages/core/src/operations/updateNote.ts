/**
 * UpdateNote Operation
 *
 * Updates an existing note's content
 */

import { updateNoteContent } from '../domain/note.js';
import { validateContent } from '../domain/invariants.js';
import { success, validationError, notFound, type Result } from '../contracts/CoreResult.js';
import { toSnapshot, type NoteSnapshot } from '../contracts/NoteSnapshot.js';
import type { UpdateNoteInput } from '../contracts/NoteInput.js';
import type { NoteRepository } from '../repositories/NoteRepository.js';

/** Updates an existing note's content */
export async function updateNoteOperation(
  input: UpdateNoteInput,
  repository: NoteRepository
): Promise<Result<NoteSnapshot>> {
  // Validate new content
  const contentValidation = validateContent(input.content);
  if (!contentValidation.valid) {
    return validationError(contentValidation.error);
  }

  // Get existing note
  const existing = await repository.get(input.id);
  if (!existing) {
    return notFound(input.id);
  }

  // Update the note (creates new immutable instance)
  const updated = updateNoteContent(existing, input.content);

  // Save to repository
  await repository.save(updated);

  // Return snapshot
  return success(toSnapshot(updated));
}
