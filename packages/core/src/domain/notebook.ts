/**
 * Notebook Entity - Hierarchical folder for organizing notes
 *
 * INVARIANT: Notebooks can nest up to 3 levels (depth 0, 1, 2)
 * INVARIANT: Inbox notebook cannot be deleted or moved
 */

import type { NotebookId, Timestamp } from './types.js';
import {
  createTimestamp,
  generateNotebookId,
  INBOX_NOTEBOOK_ID,
  TEMPLATES_NOTEBOOK_ID,
  MAX_NOTEBOOK_DEPTH,
} from './types.js';

/** The Notebook entity - immutable by design */
export interface Notebook {
  /** Unique identifier */
  readonly id: NotebookId;

  /** Display name */
  readonly name: string;

  /** Parent notebook ID (null = root level) */
  readonly parentId: NotebookId | null;

  /** Nesting depth (0 = root, 1, 2 max) */
  readonly depth: number;

  /** Sort order within parent */
  readonly order: number;

  /** When created */
  readonly createdAt: Timestamp;

  /** When last modified */
  readonly updatedAt: Timestamp;
}

/** Extended notebook with computed counts */
export interface NotebookWithMetadata extends Notebook {
  /** Number of notes in this notebook */
  readonly noteCount: number;

  /** Number of child notebooks */
  readonly childCount: number;
}

/** Tree node for hierarchical display */
export interface NotebookTreeNode {
  readonly notebook: Notebook;
  readonly children: NotebookTreeNode[];
}

/** Full notebook tree */
export type NotebookTree = NotebookTreeNode[];

/** Options for creating a new notebook */
export interface CreateNotebookOptions {
  /** Optional ID (generated if not provided) */
  id?: NotebookId;

  /** Notebook name */
  name: string;

  /** Parent notebook (null = root level) */
  parentId?: NotebookId | null;

  /** Parent's depth (used to calculate this notebook's depth) */
  parentDepth?: number;

  /** Sort order */
  order?: number;

  /** Optional creation timestamp */
  createdAt?: Timestamp;
}

/** Creates a new Notebook */
export function createNotebook(options: CreateNotebookOptions): Notebook {
  const now = createTimestamp();
  const parentId = options.parentId ?? null;
  const depth = parentId !== null ? (options.parentDepth ?? 0) + 1 : 0;

  return {
    id: options.id ?? generateNotebookId(),
    name: options.name.trim(),
    parentId,
    depth,
    order: options.order ?? 0,
    createdAt: options.createdAt ?? now,
    updatedAt: now,
  };
}

/** Creates the reserved Note Templates notebook */
export function createTemplatesNotebook(): Notebook {
  const now = createTimestamp();
  return {
    id: TEMPLATES_NOTEBOOK_ID,
    name: 'Note Templates',
    parentId: null,
    depth: 0,
    order: 1,
    createdAt: now,
    updatedAt: now,
  };
}

/** Creates the special Inbox notebook */
export function createInboxNotebook(): Notebook {
  const now = createTimestamp();

  return {
    id: INBOX_NOTEBOOK_ID,
    name: 'Inbox',
    parentId: null,
    depth: 0,
    order: 0, // Always first
    createdAt: now,
    updatedAt: now,
  };
}

/** Renames a notebook */
export function renameNotebook(notebook: Notebook, newName: string): Notebook {
  if (isInbox(notebook)) {
    // Inbox cannot be renamed
    return notebook;
  }

  return {
    ...notebook,
    name: newName.trim(),
    updatedAt: createTimestamp(),
  };
}

/** Result type for move operations */
export type MoveResult =
  | { success: true; notebook: Notebook }
  | { success: false; reason: 'INBOX_CANNOT_MOVE' | 'MAX_DEPTH_EXCEEDED' | 'CIRCULAR_REFERENCE' };

/** Moves a notebook to a new parent */
export function moveNotebook(
  notebook: Notebook,
  newParentId: NotebookId | null,
  newParentDepth: number
): MoveResult {
  // Inbox cannot be moved
  if (isInbox(notebook)) {
    return { success: false, reason: 'INBOX_CANNOT_MOVE' };
  }

  // Check depth constraint
  const newDepth = newParentId !== null ? newParentDepth + 1 : 0;
  if (newDepth > MAX_NOTEBOOK_DEPTH) {
    return { success: false, reason: 'MAX_DEPTH_EXCEEDED' };
  }

  return {
    success: true,
    notebook: {
      ...notebook,
      parentId: newParentId,
      depth: newDepth,
      updatedAt: createTimestamp(),
    },
  };
}

/** Updates the sort order of a notebook */
export function reorderNotebook(notebook: Notebook, newOrder: number): Notebook {
  return {
    ...notebook,
    order: newOrder,
    updatedAt: createTimestamp(),
  };
}

/** Checks if notebook can have children added */
export function canHaveChildren(notebook: Notebook): boolean {
  return notebook.depth < MAX_NOTEBOOK_DEPTH;
}

/** Checks if a notebook can be nested under a parent */
export function canNestUnder(parent: Notebook): boolean {
  return parent.depth < MAX_NOTEBOOK_DEPTH;
}

/** Checks if this is the special Inbox notebook */
export function isInbox(notebook: Notebook): boolean {
  return notebook.id === INBOX_NOTEBOOK_ID;
}

export function isReservedNotebook(notebook: Notebook): boolean {
  return notebook.id === INBOX_NOTEBOOK_ID || notebook.id === TEMPLATES_NOTEBOOK_ID;
}

/** Checks if a notebook can be deleted (Inbox cannot) */
export function canDelete(notebook: Notebook): boolean {
  return !isReservedNotebook(notebook);
}

/** Builds a tree structure from a flat list of notebooks */
export function buildNotebookTree(notebooks: Notebook[]): NotebookTree {
  const nodeMap = new Map<NotebookId | 'root', NotebookTreeNode[]>();
  nodeMap.set('root', []);

  // Initialize all parent containers
  for (const nb of notebooks) {
    nodeMap.set(nb.id, []);
  }

  // Build tree
  for (const nb of notebooks) {
    const node: NotebookTreeNode = {
      notebook: nb,
      children: nodeMap.get(nb.id) ?? [],
    };

    const parentKey = nb.parentId ?? 'root';
    const siblings = nodeMap.get(parentKey);
    if (siblings) {
      siblings.push(node);
    }
  }

  // Sort by order within each level
  const sortNodes = (nodes: NotebookTreeNode[]): NotebookTreeNode[] => {
    return nodes
      .sort((a, b) => {
        // Inbox always first
        if (isInbox(a.notebook)) return -1;
        if (isInbox(b.notebook)) return 1;
        return a.notebook.order - b.notebook.order;
      })
      .map(node => ({
        ...node,
        children: sortNodes(node.children),
      }));
  };

  return sortNodes(nodeMap.get('root') ?? []);
}

/** Gets the path from root to a notebook */
export function getNotebookPath(notebook: Notebook, allNotebooks: Notebook[]): Notebook[] {
  const path: Notebook[] = [notebook];
  let current = notebook;

  while (current.parentId !== null) {
    const parent = allNotebooks.find(nb => nb.id === current.parentId);
    if (!parent) break;
    path.unshift(parent);
    current = parent;
  }

  return path;
}
