/**
 * SQLite Notebook Repository
 *
 * Implements the NotebookRepository interface from @readied/core
 */

import type { NotebookRepository } from '@readied/core';
import {
  type Notebook,
  type NotebookWithMetadata,
  type NotebookTree,
  type NotebookId,
  type Timestamp,
  createNotebookId,
  createNotebook,
  buildNotebookTree,
  INBOX_NOTEBOOK_ID,
} from '@readied/core';
import type { DatabaseConnection } from '../database.js';

/** Row type from SQLite */
interface NotebookRow {
  id: string;
  name: string;
  parent_id: string | null;
  depth: number;
  order: number;
  created_at: string;
  updated_at: string;
  git_enabled: number;
  git_auto_commit: number;
  git_initialized_at: string | null;
}

/** Row with metadata counts */
interface NotebookMetadataRow extends NotebookRow {
  note_count: number;
  child_count: number;
}

/** SQLite implementation of NotebookRepository */
export class SQLiteNotebookRepository implements NotebookRepository {
  constructor(private readonly db: DatabaseConnection) {}

  /** Get a notebook by ID */
  async get(id: NotebookId): Promise<Notebook | null> {
    const stmt = this.db.prepare<NotebookRow>(`
      SELECT id, name, parent_id, depth, "order", created_at, updated_at,
             git_enabled, git_auto_commit, git_initialized_at
      FROM notebooks
      WHERE id = ?
    `);

    const row = stmt.get(id) as NotebookRow | undefined;
    if (!row) return null;

    return this.rowToNotebook(row);
  }

  /** Save a notebook (insert or update) */
  async save(notebook: Notebook): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO notebooks (id, name, parent_id, depth, "order", created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        parent_id = excluded.parent_id,
        depth = excluded.depth,
        "order" = excluded."order",
        updated_at = excluded.updated_at
    `);

    stmt.run(
      notebook.id,
      notebook.name,
      notebook.parentId,
      notebook.depth,
      notebook.order,
      notebook.createdAt,
      notebook.updatedAt
    );
  }

  /** Delete a notebook (notes move to Inbox via SET DEFAULT) */
  async delete(id: NotebookId): Promise<void> {
    // Cannot delete Inbox
    if (id === INBOX_NOTEBOOK_ID) {
      throw new Error('Cannot delete Inbox notebook');
    }

    // Move notes to Inbox before delete (in case SET DEFAULT doesn't work as expected)
    // Note: We intentionally do NOT update updated_at here - moving notes is metadata-only
    this.db.transaction(() => {
      const moveNotesStmt = this.db.prepare(`
        UPDATE notes SET notebook_id = 'inbox'
        WHERE notebook_id = ?
      `);
      moveNotesStmt.run(id);

      const deleteStmt = this.db.prepare('DELETE FROM notebooks WHERE id = ?');
      deleteStmt.run(id);
    });
  }

  /** Get all notebooks (flat list) */
  async getAll(): Promise<Notebook[]> {
    const stmt = this.db.prepare<NotebookRow>(`
      SELECT id, name, parent_id, depth, "order", created_at, updated_at,
             git_enabled, git_auto_commit, git_initialized_at
      FROM notebooks
      ORDER BY depth, "order"
    `);

    const rows = stmt.all() as NotebookRow[];
    return rows.map(row => this.rowToNotebook(row));
  }

  /** Get direct children of a notebook (or root level if null) */
  async getChildren(parentId: NotebookId | null): Promise<Notebook[]> {
    const stmt = this.db.prepare<NotebookRow>(`
      SELECT id, name, parent_id, depth, "order", created_at, updated_at,
             git_enabled, git_auto_commit, git_initialized_at
      FROM notebooks
      WHERE parent_id ${parentId === null ? 'IS NULL' : '= ?'}
      ORDER BY "order"
    `);

    const rows = (parentId === null ? stmt.all() : stmt.all(parentId)) as NotebookRow[];
    return rows.map(row => this.rowToNotebook(row));
  }

  /** Get notebook with note/child counts */
  async getWithMetadata(id: NotebookId): Promise<NotebookWithMetadata | null> {
    const stmt = this.db.prepare<NotebookMetadataRow>(`
      SELECT
        nb.id, nb.name, nb.parent_id, nb.depth, nb."order", nb.created_at, nb.updated_at,
        nb.git_enabled, nb.git_auto_commit, nb.git_initialized_at,
        (SELECT COUNT(*) FROM notes WHERE notebook_id = nb.id AND archived_at IS NULL) as note_count,
        (SELECT COUNT(*) FROM notebooks WHERE parent_id = nb.id) as child_count
      FROM notebooks nb
      WHERE nb.id = ?
    `);

    const row = stmt.get(id) as NotebookMetadataRow | undefined;
    if (!row) return null;

    return {
      ...this.rowToNotebook(row),
      noteCount: row.note_count,
      childCount: row.child_count,
    };
  }

  /** Get full tree structure */
  async getTree(): Promise<NotebookTree> {
    const notebooks = await this.getAll();
    return buildNotebookTree(notebooks);
  }

  /** Reorder notebooks within a parent */
  async reorder(parentId: NotebookId | null, orderedIds: NotebookId[]): Promise<void> {
    this.db.transaction(() => {
      const stmt = this.db.prepare(`
        UPDATE notebooks SET "order" = ?, updated_at = datetime('now')
        WHERE id = ? AND parent_id ${parentId === null ? 'IS NULL' : '= ?'}
      `);

      orderedIds.forEach((id, index) => {
        if (parentId === null) {
          stmt.run(index, id);
        } else {
          stmt.run(index, id, parentId);
        }
      });
    });
  }

  /** Get next order value for a parent */
  async getNextOrder(parentId: NotebookId | null): Promise<number> {
    const stmt = this.db.prepare<{ max_order: number | null }>(`
      SELECT MAX("order") as max_order
      FROM notebooks
      WHERE parent_id ${parentId === null ? 'IS NULL' : '= ?'}
    `);

    const row = (parentId === null ? stmt.get() : stmt.get(parentId)) as {
      max_order: number | null;
    };
    return (row.max_order ?? -1) + 1;
  }

  // ========================================================================
  // Git Operations
  // ========================================================================

  /**
   * Enable git for a notebook
   * Sets git_enabled=1 and git_initialized_at to current timestamp
   */
  enableGit(notebookId: NotebookId): void {
    const stmt = this.db.prepare(`
      UPDATE notebooks
      SET
        git_enabled = 1,
        git_initialized_at = ?,
        updated_at = ?
      WHERE id = ?
    `);

    const now = new Date().toISOString();
    stmt.run(now, now, notebookId);
  }

  /**
   * Disable git for a notebook
   * Sets git_enabled=0 but keeps git_initialized_at for history
   */
  disableGit(notebookId: NotebookId): void {
    const stmt = this.db.prepare(`
      UPDATE notebooks
      SET
        git_enabled = 0,
        updated_at = ?
      WHERE id = ?
    `);

    const now = new Date().toISOString();
    stmt.run(now, notebookId);
  }

  /**
   * Check if git is enabled for a notebook
   */
  isGitEnabled(notebookId: NotebookId): boolean {
    const stmt = this.db.prepare<{ git_enabled: number }>(`
      SELECT git_enabled
      FROM notebooks
      WHERE id = ?
    `);

    const row = stmt.get(notebookId) as { git_enabled: number } | undefined;
    return row ? row.git_enabled === 1 : false;
  }

  /**
   * Get git settings for a notebook
   */
  getGitSettings(notebookId: NotebookId): {
    enabled: boolean;
    autoCommit: boolean;
    initializedAt: string | null;
  } | null {
    const stmt = this.db.prepare<{
      git_enabled: number;
      git_auto_commit: number;
      git_initialized_at: string | null;
    }>(`
      SELECT git_enabled, git_auto_commit, git_initialized_at
      FROM notebooks
      WHERE id = ?
    `);

    const row = stmt.get(notebookId) as
      | { git_enabled: number; git_auto_commit: number; git_initialized_at: string | null }
      | undefined;

    if (!row) return null;

    return {
      enabled: row.git_enabled === 1,
      autoCommit: row.git_auto_commit === 1,
      initializedAt: row.git_initialized_at,
    };
  }

  /**
   * Toggle auto-commit for a git-enabled notebook
   */
  setGitAutoCommit(notebookId: NotebookId, enabled: boolean): void {
    const stmt = this.db.prepare(`
      UPDATE notebooks
      SET
        git_auto_commit = ?,
        updated_at = ?
      WHERE id = ?
    `);

    const now = new Date().toISOString();
    stmt.run(enabled ? 1 : 0, now, notebookId);
  }

  /**
   * Get all git-enabled notebooks
   */
  getGitEnabledNotebooks(): Notebook[] {
    const stmt = this.db.prepare<NotebookRow>(`
      SELECT id, name, parent_id, depth, "order", created_at, updated_at,
             git_enabled, git_auto_commit, git_initialized_at
      FROM notebooks
      WHERE git_enabled = 1
      ORDER BY name ASC
    `);

    const rows = stmt.all() as NotebookRow[];
    return rows.map(row => this.rowToNotebook(row));
  }

  // Private helpers

  private rowToNotebook(row: NotebookRow): Notebook {
    return createNotebook({
      id: createNotebookId(row.id),
      name: row.name,
      parentId: row.parent_id ? createNotebookId(row.parent_id) : null,
      parentDepth: row.depth > 0 ? row.depth - 1 : undefined,
      order: row.order,
      createdAt: row.created_at as Timestamp,
    });
  }
}
