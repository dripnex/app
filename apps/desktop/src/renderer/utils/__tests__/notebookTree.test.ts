import { describe, expect, it } from 'vitest';
import type { NotebookTreeNode } from '../../../preload/index';
import { collectNotebookSubtreeIds, findNotebookNode, notebookIsInSubtree } from '../notebookTree';

function node(id: string, children: NotebookTreeNode[] = []): NotebookTreeNode {
  return {
    notebook: {
      id,
      name: id,
      parentId: null,
      depth: 0,
      order: 0,
      createdAt: '',
      updatedAt: '',
    },
    children,
  };
}

const tree = [node('work', [node('api'), node('web', [node('marketing')])]), node('personal')];

describe('notebookTree', () => {
  it('finds a nested node', () => {
    expect(findNotebookNode(tree, 'marketing')?.notebook.id).toBe('marketing');
    expect(findNotebookNode(tree, 'missing')).toBeNull();
  });

  it('collects the root and descendants', () => {
    expect(collectNotebookSubtreeIds(tree, 'work')).toEqual(['work', 'api', 'web', 'marketing']);
    expect(collectNotebookSubtreeIds(tree, 'web')).toEqual(['web', 'marketing']);
  });

  it('reports membership in a subtree', () => {
    expect(notebookIsInSubtree(tree, 'work', 'api')).toBe(true);
    expect(notebookIsInSubtree(tree, 'work', 'personal')).toBe(false);
  });
});
