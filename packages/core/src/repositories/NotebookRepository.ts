/**
 * NotebookRepository Interface
 *
 * Port for notebook storage operations (Hexagonal Architecture)
 */

import type { Notebook, NotebookWithMetadata, NotebookTree } from '../domain/notebook.js';
import type { NotebookId } from '../domain/types.js';

/** Repository interface for notebook storage (port) */
export interface NotebookRepository {
  /** Get a single notebook by ID */
  get(id: NotebookId): Promise<Notebook | null>;

  /** Save (insert or update) a notebook */
  save(notebook: Notebook): Promise<void>;

  /** Delete a notebook (notes move to Inbox) */
  delete(id: NotebookId): Promise<void>;

  /** Get all notebooks (flat list) */
  getAll(): Promise<Notebook[]>;

  /** Get direct children of a notebook (or root level if null) */
  getChildren(parentId: NotebookId | null): Promise<Notebook[]>;

  /** Get notebook with note/child counts */
  getWithMetadata(id: NotebookId): Promise<NotebookWithMetadata | null>;

  /** Get full tree structure */
  getTree(): Promise<NotebookTree>;

  /** Get next order number for a new notebook in a parent */
  getNextOrder(parentId: NotebookId | null): Promise<number>;

  /** Reorder notebooks within a parent */
  reorder(parentId: NotebookId | null, orderedIds: NotebookId[]): Promise<void>;
}
