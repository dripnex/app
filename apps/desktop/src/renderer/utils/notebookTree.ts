import type { NotebookTreeNode } from '../../preload/index';

/** Find a node anywhere in the forest. */
export function findNotebookNode(
  tree: readonly NotebookTreeNode[],
  id: string
): NotebookTreeNode | null {
  for (const node of tree) {
    if (node.notebook.id === id) return node;
    const found = findNotebookNode(node.children, id);
    if (found) return found;
  }
  return null;
}

/** Root plus every descendant. Order is preorder. */
export function collectNotebookSubtreeIds(
  tree: readonly NotebookTreeNode[],
  rootId: string
): string[] {
  const root = findNotebookNode(tree, rootId);
  if (!root) return [rootId];
  const ids: string[] = [];
  function walk(node: NotebookTreeNode) {
    ids.push(node.notebook.id);
    for (const child of node.children) walk(child);
  }
  walk(root);
  return ids;
}

export function notebookIsInSubtree(
  tree: readonly NotebookTreeNode[],
  rootId: string,
  candidateId: string
): boolean {
  return collectNotebookSubtreeIds(tree, rootId).includes(candidateId);
}
