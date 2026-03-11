import { describe, it, expect } from 'vitest';

function validateNotebookTree(
  changes: Array<{ notebookId: string; operation: string; data?: string | null }>,
  existingNotebooks: Map<string, { parentId: string | null; depth: number }>
): { valid: true } | { valid: false; error: string; notebookId: string } {
  const tree = new Map(existingNotebooks);

  for (const change of changes) {
    if (change.operation === 'delete') {
      tree.delete(change.notebookId);
      continue;
    }
    if (!change.data) continue;
    const parsed = JSON.parse(change.data) as {
      name: string;
      parentId: string | null;
      depth: number;
      order: number;
    };

    if (parsed.depth > 2) {
      return { valid: false, error: `depth exceeds max (2), got ${parsed.depth}`, notebookId: change.notebookId };
    }
    if (parsed.parentId && !tree.has(parsed.parentId)) {
      return { valid: false, error: `parentId '${parsed.parentId}' not found`, notebookId: change.notebookId };
    }
    if (parsed.parentId) {
      const visited = new Set<string>([change.notebookId]);
      let current: string | null = parsed.parentId;
      while (current) {
        if (visited.has(current)) {
          return { valid: false, error: 'circular reference detected', notebookId: change.notebookId };
        }
        visited.add(current);
        current = tree.get(current)?.parentId ?? null;
      }
    }
    tree.set(change.notebookId, { parentId: parsed.parentId, depth: parsed.depth });
  }
  return { valid: true };
}

describe('validateNotebookTree', () => {
  it('accepts valid root notebook', () => {
    const result = validateNotebookTree(
      [{ notebookId: 'nb-1', operation: 'create', data: JSON.stringify({ name: 'Work', parentId: null, depth: 0, order: 0 }) }],
      new Map()
    );
    expect(result).toEqual({ valid: true });
  });

  it('accepts valid child notebook (depth 1)', () => {
    const existing = new Map([['nb-1', { parentId: null, depth: 0 }]]);
    const result = validateNotebookTree(
      [{ notebookId: 'nb-2', operation: 'create', data: JSON.stringify({ name: 'Sub', parentId: 'nb-1', depth: 1, order: 0 }) }],
      existing
    );
    expect(result).toEqual({ valid: true });
  });

  it('rejects depth > 2', () => {
    const result = validateNotebookTree(
      [{ notebookId: 'nb-deep', operation: 'create', data: JSON.stringify({ name: 'Deep', parentId: 'nb-2', depth: 3, order: 0 }) }],
      new Map([['nb-2', { parentId: 'nb-1', depth: 2 }]])
    );
    expect(result).toEqual({ valid: false, error: 'depth exceeds max (2), got 3', notebookId: 'nb-deep' });
  });

  it('rejects missing parentId', () => {
    const result = validateNotebookTree(
      [{ notebookId: 'nb-orphan', operation: 'create', data: JSON.stringify({ name: 'Orphan', parentId: 'nb-ghost', depth: 1, order: 0 }) }],
      new Map()
    );
    expect(result).toEqual({ valid: false, error: "parentId 'nb-ghost' not found", notebookId: 'nb-orphan' });
  });

  it('detects circular reference A->B->A', () => {
    const existing = new Map([['nb-a', { parentId: 'nb-b', depth: 1 }]]);
    const result = validateNotebookTree(
      [{ notebookId: 'nb-b', operation: 'update', data: JSON.stringify({ name: 'B', parentId: 'nb-a', depth: 1, order: 0 }) }],
      existing
    );
    expect(result).toEqual({ valid: false, error: 'circular reference detected', notebookId: 'nb-b' });
  });

  it('detects self-reference via missing parentId', () => {
    const result = validateNotebookTree(
      [{ notebookId: 'nb-self', operation: 'create', data: JSON.stringify({ name: 'Self', parentId: 'nb-self', depth: 1, order: 0 }) }],
      new Map()
    );
    expect(result).toEqual({ valid: false, error: "parentId 'nb-self' not found", notebookId: 'nb-self' });
  });

  it('accepts delete operation', () => {
    const existing = new Map([['nb-1', { parentId: null, depth: 0 }]]);
    const result = validateNotebookTree(
      [{ notebookId: 'nb-1', operation: 'delete' }],
      existing
    );
    expect(result).toEqual({ valid: true });
  });

  it('handles two devices creating notebooks under same parent', () => {
    const existing = new Map([['nb-root', { parentId: null, depth: 0 }]]);
    const result = validateNotebookTree(
      [
        { notebookId: 'nb-a', operation: 'create', data: JSON.stringify({ name: 'A', parentId: 'nb-root', depth: 1, order: 0 }) },
        { notebookId: 'nb-b', operation: 'create', data: JSON.stringify({ name: 'B', parentId: 'nb-root', depth: 1, order: 1 }) },
      ],
      existing
    );
    expect(result).toEqual({ valid: true });
  });
});
