/**
 * GetNote Operation
 *
 * Retrieves a note by ID
 */

import { success, notFound, type Result } from '../contracts/CoreResult.js';
import { toSnapshot, type NoteSnapshot } from '../contracts/NoteSnapshot.js';
import type { GetNoteInput } from '../contracts/NoteInput.js';
import type { NoteRepository } from '../repositories/NoteRepository.js';

/** Gets a note by ID */
export async function getNoteOperation(
  input: GetNoteInput,
  repository: NoteRepository
): Promise<Result<NoteSnapshot>> {
  const note = await repository.get(input.id);

  if (!note) {
    return notFound(input.id);
  }

  return success(toSnapshot(note));
}
