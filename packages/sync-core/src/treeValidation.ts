/**
 * Notebook tree validation for sync.
 *
 * Validates that pushed notebook changes maintain tree integrity:
 * - depth <= 2
 * - parentId references existing notebook
 * - No circular references
 */

export interface TreeNode {
  parentId: string | null;
  depth: number;
}

export type TreeValidationResult =
  | { valid: true }
  | { valid: false; error: string; notebookId: string };

export function validateNotebookTree(
  changes: Array<{ notebookId: string; operation: string; data?: string | null }>,
  existingNotebooks: Map<string, TreeNode>
): TreeValidationResult {
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
      return {
        valid: false,
        error: `depth exceeds max (2), got ${parsed.depth}`,
        notebookId: change.notebookId,
      };
    }

    if (parsed.parentId && !tree.has(parsed.parentId)) {
      return {
        valid: false,
        error: `parentId '${parsed.parentId}' not found`,
        notebookId: change.notebookId,
      };
    }

    if (parsed.parentId) {
      const visited = new Set<string>([change.notebookId]);
      let current: string | null = parsed.parentId;
      while (current) {
        if (visited.has(current)) {
          return {
            valid: false,
            error: 'circular reference detected',
            notebookId: change.notebookId,
          };
        }
        visited.add(current);
        current = tree.get(current)?.parentId ?? null;
      }
    }

    tree.set(change.notebookId, { parentId: parsed.parentId, depth: parsed.depth });
  }

  return { valid: true };
}
