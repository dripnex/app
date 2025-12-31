import { describe, it, expect, beforeEach } from 'vitest';
import type { Note } from '../src/domain/note.js';
import type { NoteId } from '../src/domain/types.js';
import { createNoteId } from '../src/domain/types.js';
import { createNoteOperation, type NoteRepository } from '../src/operations/createNote.js';
import { updateNoteOperation } from '../src/operations/updateNote.js';
import { deleteNoteOperation } from '../src/operations/deleteNote.js';
import { getNoteOperation } from '../src/operations/getNote.js';
import { archiveNoteOperation } from '../src/operations/archiveNote.js';
import { restoreNoteOperation } from '../src/operations/restoreNote.js';
import { duplicateNoteOperation } from '../src/operations/duplicateNote.js';

/** In-memory repository for testing */
class InMemoryNoteRepository implements NoteRepository {
  private notes = new Map<NoteId, Note>();

  async get(id: NoteId): Promise<Note | null> {
    return this.notes.get(id) ?? null;
  }

  async save(note: Note): Promise<void> {
    this.notes.set(note.id, note);
  }

  async delete(id: NoteId): Promise<void> {
    this.notes.delete(id);
  }

  // Test helper
  size(): number {
    return this.notes.size;
  }
}

describe('Operations', () => {
  let repository: InMemoryNoteRepository;

  beforeEach(() => {
    repository = new InMemoryNoteRepository();
  });

  describe('createNoteOperation', () => {
    it('creates a note successfully', async () => {
      const result = await createNoteOperation(
        { content: '# My First Note' },
        repository
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.title).toBe('My First Note');
        expect(result.data.content).toBe('# My First Note');
      }
      expect(repository.size()).toBe(1);
    });

    it('creates note with custom ID', async () => {
      const result = await createNoteOperation(
        { content: '# Test', id: 'custom-id' },
        repository
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.id).toBe('custom-id');
      }
    });

    it('fails when note with ID already exists', async () => {
      await createNoteOperation({ content: '# First', id: 'same-id' }, repository);
      const result = await createNoteOperation(
        { content: '# Second', id: 'same-id' },
        repository
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('ALREADY_EXISTS');
      }
    });

    it('fails with empty content validation', async () => {
      // Empty content is actually valid (MIN_CONTENT_LENGTH = 0)
      const result = await createNoteOperation({ content: '' }, repository);

      expect(result.ok).toBe(true);
    });
  });

  describe('updateNoteOperation', () => {
    it('updates note content successfully', async () => {
      // Create a note first
      const createResult = await createNoteOperation(
        { content: '# Original', id: 'note-1' },
        repository
      );
      expect(createResult.ok).toBe(true);

      // Update it
      const noteId = createNoteId('note-1');
      const updateResult = await updateNoteOperation(
        { id: noteId, content: '# Updated Content' },
        repository
      );

      expect(updateResult.ok).toBe(true);
      if (updateResult.ok) {
        expect(updateResult.data.title).toBe('Updated Content');
        expect(updateResult.data.content).toBe('# Updated Content');
      }
    });

    it('fails when note does not exist', async () => {
      const noteId = createNoteId('non-existent');
      const result = await updateNoteOperation(
        { id: noteId, content: '# Test' },
        repository
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('NOT_FOUND');
      }
    });
  });

  describe('deleteNoteOperation', () => {
    it('deletes note successfully', async () => {
      // Create a note first
      await createNoteOperation({ content: '# To Delete', id: 'delete-me' }, repository);
      expect(repository.size()).toBe(1);

      // Delete it
      const noteId = createNoteId('delete-me');
      const result = await deleteNoteOperation({ id: noteId }, repository);

      expect(result.ok).toBe(true);
      expect(repository.size()).toBe(0);
    });

    it('fails when note does not exist', async () => {
      const noteId = createNoteId('non-existent');
      const result = await deleteNoteOperation({ id: noteId }, repository);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('NOT_FOUND');
      }
    });
  });

  describe('getNoteOperation', () => {
    it('gets note successfully', async () => {
      await createNoteOperation({ content: '# Find Me', id: 'find-me' }, repository);

      const noteId = createNoteId('find-me');
      const result = await getNoteOperation({ id: noteId }, repository);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.title).toBe('Find Me');
      }
    });

    it('fails when note does not exist', async () => {
      const noteId = createNoteId('non-existent');
      const result = await getNoteOperation({ id: noteId }, repository);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('NOT_FOUND');
      }
    });
  });

  describe('archiveNoteOperation', () => {
    it('archives a note successfully', async () => {
      await createNoteOperation({ content: '# Archive Me', id: 'archive-me' }, repository);

      const noteId = createNoteId('archive-me');
      const result = await archiveNoteOperation({ id: noteId }, repository);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.isArchived).toBe(true);
        expect(result.data.archivedAt).not.toBeNull();
      }
    });

    it('fails when note does not exist', async () => {
      const noteId = createNoteId('non-existent');
      const result = await archiveNoteOperation({ id: noteId }, repository);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('NOT_FOUND');
      }
    });

    it('fails when note is already archived', async () => {
      await createNoteOperation({ content: '# Test', id: 'already-archived' }, repository);
      const noteId = createNoteId('already-archived');

      // Archive once
      await archiveNoteOperation({ id: noteId }, repository);

      // Try to archive again
      const result = await archiveNoteOperation({ id: noteId }, repository);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('restoreNoteOperation', () => {
    it('restores an archived note successfully', async () => {
      await createNoteOperation({ content: '# Restore Me', id: 'restore-me' }, repository);
      const noteId = createNoteId('restore-me');

      // Archive first
      await archiveNoteOperation({ id: noteId }, repository);

      // Now restore
      const result = await restoreNoteOperation({ id: noteId }, repository);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.isArchived).toBe(false);
        expect(result.data.archivedAt).toBeNull();
      }
    });

    it('fails when note does not exist', async () => {
      const noteId = createNoteId('non-existent');
      const result = await restoreNoteOperation({ id: noteId }, repository);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('NOT_FOUND');
      }
    });

    it('fails when note is not archived', async () => {
      await createNoteOperation({ content: '# Not Archived', id: 'not-archived' }, repository);
      const noteId = createNoteId('not-archived');

      const result = await restoreNoteOperation({ id: noteId }, repository);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('duplicateNoteOperation', () => {
    it('duplicates a note successfully', async () => {
      await createNoteOperation({ content: '# Original Note', id: 'original' }, repository);
      const noteId = createNoteId('original');

      const result = await duplicateNoteOperation({ id: noteId }, repository);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.id).not.toBe('original');
        expect(result.data.content).toBe('# Original Note');
        expect(result.data.title).toBe('Original Note (copy)');
        expect(result.data.isArchived).toBe(false);
      }

      // Should have 2 notes now
      expect(repository.size()).toBe(2);
    });

    it('fails when note does not exist', async () => {
      const noteId = createNoteId('non-existent');
      const result = await duplicateNoteOperation({ id: noteId }, repository);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('NOT_FOUND');
      }
    });

    it('can duplicate an archived note (copy is not archived)', async () => {
      await createNoteOperation({ content: '# Archived', id: 'archived-note' }, repository);
      const noteId = createNoteId('archived-note');

      // Archive it
      await archiveNoteOperation({ id: noteId }, repository);

      // Duplicate it
      const result = await duplicateNoteOperation({ id: noteId }, repository);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.isArchived).toBe(false);
      }
    });
  });
});
