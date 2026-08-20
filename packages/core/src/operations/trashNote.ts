import { softDeleteNote } from '../domain/note.js';
import type { NoteId } from '../domain/types.js';
import { success, notFound, type Result } from '../contracts/CoreResult.js';
import { toSnapshot, type NoteSnapshot } from '../contracts/NoteSnapshot.js';
import type { NoteRepository } from '../repositories/NoteRepository.js';

export interface TrashNoteInput {
  id: NoteId;
}

/** Move a note to trash through the repository. */
export async function trashNoteOperation(
  input: TrashNoteInput,
  repository: NoteRepository
): Promise<Result<NoteSnapshot>> {
  const existing = await repository.get(input.id);
  if (!existing) {
    return notFound(input.id);
  }

  const trashed = softDeleteNote(existing);
  await repository.save(trashed);
  return success(toSnapshot(trashed));
}
