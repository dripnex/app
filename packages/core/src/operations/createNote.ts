/**
 * CreateNote Operation
 *
 * Creates a new note from markdown content
 */

import { createNote } from '../domain/note.js';
import { createNoteId } from '../domain/types.js';
import { validateContent, validateNoteId } from '../domain/invariants.js';
import { success, validationError, alreadyExists, type Result } from '../contracts/CoreResult.js';
import { toSnapshot, type NoteSnapshot } from '../contracts/NoteSnapshot.js';
import type { CreateNoteInput } from '../contracts/NoteInput.js';
import type { NoteRepository } from '../repositories/NoteRepository.js';

/** Creates a new note and saves it to the repository */
export async function createNoteOperation(
  input: CreateNoteInput,
  repository: NoteRepository
): Promise<Result<NoteSnapshot>> {
  // Validate content
  const contentValidation = validateContent(input.content);
  if (!contentValidation.valid) {
    return validationError(contentValidation.error);
  }

  // Create note ID (use provided or generate)
  const noteId = input.id ? createNoteId(input.id) : undefined;

  // If ID provided, validate it
  if (noteId) {
    const idValidation = validateNoteId(noteId);
    if (!idValidation.valid) {
      return validationError(idValidation.error);
    }

    // Check if note with this ID already exists
    const existing = await repository.get(noteId);
    if (existing) {
      return alreadyExists(noteId);
    }
  }

  // Create the note
  const note = createNote({
    id: noteId,
    content: input.content,
  });

  // Save to repository
  await repository.save(note);

  // Return snapshot
  return success(toSnapshot(note));
}
