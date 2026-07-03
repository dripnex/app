import { describe, it, expect } from 'vitest';
import { createNote, setBoardStage } from '../src/domain/note.js';
import {
  createInboxNotebook,
  createPlanningNotebook,
  canDelete,
  isPlanning,
} from '../src/domain/notebook.js';
import { toSnapshot } from '../src/contracts/NoteSnapshot.js';
import { PLANNING_NOTEBOOK_ID, DEFAULT_BOARD_STAGE } from '../src/domain/types.js';

describe('Board stage (Kanban)', () => {
  describe('createNote board stage default', () => {
    it('is null for a note outside the Planning notebook', () => {
      const note = createNote({ content: '# Task' });
      expect(note.boardStage).toBeNull();
    });

    it("defaults to 'backlog' for a note created in the Planning notebook", () => {
      const note = createNote({ content: '# Task', notebookId: PLANNING_NOTEBOOK_ID });
      expect(note.boardStage).toBe(DEFAULT_BOARD_STAGE);
      expect(note.boardStage).toBe('backlog');
    });

    it('honors an explicit boardStage option', () => {
      const note = createNote({ content: '# Task', boardStage: 'in_progress' });
      expect(note.boardStage).toBe('in_progress');
    });
  });

  describe('setBoardStage', () => {
    it('changes only the stage and preserves content', () => {
      const original = createNote({ content: '# Task', notebookId: PLANNING_NOTEBOOK_ID });
      const moved = setBoardStage(original, 'in_review');

      expect(moved.boardStage).toBe('in_review');
      expect(moved.content).toBe(original.content);
    });

    it('does NOT update updatedAt (metadata-only)', () => {
      const original = createNote({ content: '# Task', notebookId: PLANNING_NOTEBOOK_ID });
      const moved = setBoardStage(original, 'todo');

      expect(moved.metadata.updatedAt).toBe(original.metadata.updatedAt);
    });

    it('accepts null to remove the note from the board', () => {
      const original = createNote({ content: '# Task', boardStage: 'todo' });
      const off = setBoardStage(original, null);

      expect(off.boardStage).toBeNull();
    });
  });

  describe('toSnapshot', () => {
    it('includes boardStage', () => {
      const note = createNote({ content: '# Task', notebookId: PLANNING_NOTEBOOK_ID });
      expect(toSnapshot(note).boardStage).toBe('backlog');
    });
  });
});

describe('Planning notebook', () => {
  it('createPlanningNotebook uses the reserved id and name', () => {
    const nb = createPlanningNotebook();
    expect(nb.id).toBe(PLANNING_NOTEBOOK_ID);
    expect(nb.name).toBe('Planning');
    expect(isPlanning(nb)).toBe(true);
  });

  it('cannot be deleted', () => {
    expect(canDelete(createPlanningNotebook())).toBe(false);
  });

  it('a regular notebook is not the Planning notebook', () => {
    expect(isPlanning(createInboxNotebook())).toBe(false);
  });
});
