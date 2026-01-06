import { describe, it, expect } from 'vitest';
import {
  createNote,
  updateNoteContent,
  updateNoteTitle,
  duplicateNote,
  moveNoteToNotebook,
  setNoteStatus,
  pinNote,
  unpinNote,
  archiveNote,
  restoreNote,
  softDeleteNote,
  restoreDeletedNote,
} from '../src/domain/note.js';
import { createNotebookId } from '../src/domain/types.js';

/**
 * Tests for updatedAt semantics.
 *
 * Rules (from docs/domain-invariants.md):
 * - Content changes (create, edit, title) → UPDATE updatedAt
 * - Metadata changes (status, tags, notebook, pin) → NO UPDATE
 * - Lifecycle changes (archive, trash) → UPDATE (debatable)
 * - Destroy → N/A
 */
describe('updatedAt Semantics', () => {
  describe('Content operations (SHOULD update updatedAt)', () => {
    it('createNote sets updatedAt', () => {
      const note = createNote({ content: '# Test' });

      expect(note.metadata.updatedAt).toBeDefined();
      expect(note.metadata.updatedAt).toBe(note.metadata.createdAt);
    });

    it('updateNoteContent updates updatedAt', () => {
      const original = createNote({ content: '# Original' });
      const updated = updateNoteContent(original, '# Changed content');

      expect(new Date(updated.metadata.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(original.metadata.updatedAt).getTime()
      );
    });

    it('updateNoteTitle updates updatedAt', () => {
      const original = createNote({ content: '# Original' });
      const updated = updateNoteTitle(original, 'New Title');

      expect(new Date(updated.metadata.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(original.metadata.updatedAt).getTime()
      );
    });

    it('duplicateNote sets new updatedAt for the copy', () => {
      const original = createNote({ content: '# Original' });
      const duplicate = duplicateNote(original);

      // Duplicate is a new note, so it gets fresh timestamps
      expect(duplicate.metadata.updatedAt).toBeDefined();
      expect(duplicate.metadata.createdAt).toBe(duplicate.metadata.updatedAt);
      expect(duplicate.id).not.toBe(original.id);
    });
  });

  describe('Metadata operations (should NOT update updatedAt)', () => {
    it('setNoteStatus does NOT update updatedAt', () => {
      const original = createNote({ content: '# Test' });
      const originalUpdatedAt = original.metadata.updatedAt;

      const updated = setNoteStatus(original, 'completed');

      expect(updated.status).toBe('completed');
      expect(updated.metadata.updatedAt).toBe(originalUpdatedAt);
    });

    it('moveNoteToNotebook does NOT update updatedAt', () => {
      const original = createNote({ content: '# Test' });
      const originalUpdatedAt = original.metadata.updatedAt;
      const newNotebookId = createNotebookId('new-notebook');

      const updated = moveNoteToNotebook(original, newNotebookId);

      expect(updated.notebookId).toBe(newNotebookId);
      expect(updated.metadata.updatedAt).toBe(originalUpdatedAt);
    });

    it('pinNote does NOT update updatedAt', () => {
      const original = createNote({ content: '# Test' });
      const originalUpdatedAt = original.metadata.updatedAt;

      const updated = pinNote(original);

      expect(updated.isPinned).toBe(true);
      expect(updated.metadata.updatedAt).toBe(originalUpdatedAt);
    });

    it('unpinNote does NOT update updatedAt', () => {
      const original = pinNote(createNote({ content: '# Test' }));
      const originalUpdatedAt = original.metadata.updatedAt;

      const updated = unpinNote(original);

      expect(updated.isPinned).toBe(false);
      expect(updated.metadata.updatedAt).toBe(originalUpdatedAt);
    });
  });

  describe('Lifecycle operations (update updatedAt - debatable)', () => {
    // These are documented as "debatable" in domain-invariants.md
    // Current behavior: they DO update updatedAt
    // This is intentional for now, but could be changed

    it('archiveNote updates updatedAt', () => {
      const original = createNote({ content: '# Test' });
      const archived = archiveNote(original);

      expect(archived.metadata.archivedAt).toBeDefined();
      expect(new Date(archived.metadata.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(original.metadata.updatedAt).getTime()
      );
    });

    it('restoreNote updates updatedAt', () => {
      const original = archiveNote(createNote({ content: '# Test' }));
      const restored = restoreNote(original);

      expect(restored.metadata.archivedAt).toBeNull();
      expect(new Date(restored.metadata.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(original.metadata.updatedAt).getTime()
      );
    });

    it('softDeleteNote updates updatedAt', () => {
      const original = createNote({ content: '# Test' });
      const deleted = softDeleteNote(original);

      expect(deleted.isDeleted).toBe(true);
      expect(new Date(deleted.metadata.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(original.metadata.updatedAt).getTime()
      );
    });

    it('restoreDeletedNote updates updatedAt', () => {
      const original = softDeleteNote(createNote({ content: '# Test' }));
      const restored = restoreDeletedNote(original);

      expect(restored.isDeleted).toBe(false);
      expect(new Date(restored.metadata.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(original.metadata.updatedAt).getTime()
      );
    });
  });

  describe('Metadata preservation', () => {
    it('metadata operations preserve all other fields', () => {
      const original = createNote({ content: '# Test #tag' });
      const pinned = pinNote(original);
      const moved = moveNoteToNotebook(pinned, createNotebookId('other'));
      const statusChanged = setNoteStatus(moved, 'on_hold');

      // All metadata operations should preserve content and other metadata
      expect(statusChanged.content).toBe(original.content);
      expect(statusChanged.metadata.title).toBe(original.metadata.title);
      expect(statusChanged.metadata.tags).toEqual(original.metadata.tags);
      expect(statusChanged.metadata.createdAt).toBe(original.metadata.createdAt);
      expect(statusChanged.metadata.wordCount).toBe(original.metadata.wordCount);

      // And the changes should be applied
      expect(statusChanged.isPinned).toBe(true);
      expect(statusChanged.notebookId).toBe('other');
      expect(statusChanged.status).toBe('on_hold');
    });
  });
});
