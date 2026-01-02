/**
 * UpdateTitle Operation
 *
 * Updates an existing note's title (structural, independent from content)
 */

import { updateNoteTitle } from '../domain/note.js';
import { validateTitle } from '../domain/invariants.js';
import { success, validationError, notFound, type Result } from '../contracts/CoreResult.js';
import { toSnapshot, type NoteSnapshot } from '../contracts/NoteSnapshot.js';
import type { UpdateTitleInput } from '../contracts/NoteInput.js';
import type { NoteRepository } from '../repositories/NoteRepository.js';

/** Updates an existing note's title */
export async function updateTitleOperation(
  input: UpdateTitleInput,
  repository: NoteRepository
): Promise<Result<NoteSnapshot>> {
  // Validate title
  const titleValidation = validateTitle(input.title);
  if (!titleValidation.valid) {
    return validationError(titleValidation.error);
  }

  // Get existing note
  const existing = await repository.get(input.id);
  if (!existing) {
    return notFound(input.id);
  }

  // Update the note title (creates new immutable instance)
  const updated = updateNoteTitle(existing, input.title.trim());

  // Save to repository
  await repository.save(updated);

  // Return snapshot
  return success(toSnapshot(updated));
}
