import { describe, it, expect } from 'vitest';
import { validateNotebookTree } from '../src/treeValidation.js';

describe('validateNotebookTree', () => {
  it('accepts valid root notebook', () => {
    const result = validateNotebookTree(
      [
        {
          notebookId: 'nb-1',
          operation: 'create',
          data: JSON.stringify({ name: 'Work', parentId: null, depth: 0, order: 0 }),
        },
      ],
      new Map()
    );
    expect(result).toEqual({ valid: true });
  });

  it('accepts valid child notebook (depth 1)', () => {
    const existing = new Map([['nb-1', { parentId: null, depth: 0 }]]);
    const result = validateNotebookTree(
      [
        {
          notebookId: 'nb-2',
          operation: 'create',
          data: JSON.stringify({ name: 'Sub', parentId: 'nb-1', depth: 1, order: 0 }),
        },
      ],
      existing
    );
    expect(result).toEqual({ valid: true });
  });

  it('rejects depth > 2', () => {
    const result = validateNotebookTree(
      [
        {
          notebookId: 'nb-deep',
          operation: 'create',
          data: JSON.stringify({ name: 'Deep', parentId: 'nb-2', depth: 3, order: 0 }),
        },
      ],
      new Map([['nb-2', { parentId: 'nb-1', depth: 2 }]])
    );
    expect(result).toEqual({
      valid: false,
      error: 'depth exceeds max (2), got 3',
      notebookId: 'nb-deep',
    });
  });

  it('rejects missing parentId', () => {
    const result = validateNotebookTree(
      [
        {
          notebookId: 'nb-orphan',
          operation: 'create',
          data: JSON.stringify({ name: 'Orphan', parentId: 'nb-ghost', depth: 1, order: 0 }),
        },
      ],
      new Map()
    );
    expect(result).toEqual({
      valid: false,
      error: "parentId 'nb-ghost' not found",
      notebookId: 'nb-orphan',
    });
  });

  it('detects circular reference A->B->A', () => {
    const existing = new Map([['nb-a', { parentId: 'nb-b', depth: 1 }]]);
    const result = validateNotebookTree(
      [
        {
          notebookId: 'nb-b',
          operation: 'update',
          data: JSON.stringify({ name: 'B', parentId: 'nb-a', depth: 1, order: 0 }),
        },
      ],
      existing
    );
    expect(result).toEqual({
      valid: false,
      error: 'circular reference detected',
      notebookId: 'nb-b',
    });
  });

  it('detects self-reference via missing parentId', () => {
    const result = validateNotebookTree(
      [
        {
          notebookId: 'nb-self',
          operation: 'create',
          data: JSON.stringify({ name: 'Self', parentId: 'nb-self', depth: 1, order: 0 }),
        },
      ],
      new Map()
    );
    expect(result).toEqual({
      valid: false,
      error: "parentId 'nb-self' not found",
      notebookId: 'nb-self',
    });
  });

  it('accepts delete operation', () => {
    const existing = new Map([['nb-1', { parentId: null, depth: 0 }]]);
    const result = validateNotebookTree([{ notebookId: 'nb-1', operation: 'delete' }], existing);
    expect(result).toEqual({ valid: true });
  });

  it('handles two devices creating notebooks under same parent', () => {
    const existing = new Map([['nb-root', { parentId: null, depth: 0 }]]);
    const result = validateNotebookTree(
      [
        {
          notebookId: 'nb-a',
          operation: 'create',
          data: JSON.stringify({ name: 'A', parentId: 'nb-root', depth: 1, order: 0 }),
        },
        {
          notebookId: 'nb-b',
          operation: 'create',
          data: JSON.stringify({ name: 'B', parentId: 'nb-root', depth: 1, order: 1 }),
        },
      ],
      existing
    );
    expect(result).toEqual({ valid: true });
  });
});
