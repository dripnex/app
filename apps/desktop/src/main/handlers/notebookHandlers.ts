/**
 * Notebook IPC Handlers
 *
 * Handles notebook CRUD, git settings per notebook, and reordering.
 */

import { ipcMain } from 'electron';
import {
  createNotebookId,
  createNotebook,
  renameNotebook,
  moveNotebook,
  INBOX_NOTEBOOK_ID,
} from '@readied/core';
import type { SQLiteNotebookRepository } from './types.js';

export interface NotebookHandlerDeps {
  notebookRepository: SQLiteNotebookRepository;
}

export function registerNotebookHandlers(deps: NotebookHandlerDeps): void {
  const { notebookRepository: repo } = deps;

  // List all notebooks
  ipcMain.handle('notebooks:list', async () => {
    const notebooks = await repo.getAll();
    return notebooks.map(nb => ({
      id: nb.id,
      name: nb.name,
      parentId: nb.parentId,
      depth: nb.depth,
      order: nb.order,
      createdAt: nb.createdAt,
      updatedAt: nb.updatedAt,
    }));
  });

  // Get notebook tree
  ipcMain.handle('notebooks:tree', async () => {
    return repo.getTree();
  });

  // Get single notebook
  ipcMain.handle('notebooks:get', async (_event, id: string) => {
    const notebook = await repo.get(createNotebookId(id));
    if (!notebook) return null;
    return {
      id: notebook.id,
      name: notebook.name,
      parentId: notebook.parentId,
      depth: notebook.depth,
      order: notebook.order,
      createdAt: notebook.createdAt,
      updatedAt: notebook.updatedAt,
    };
  });

  // Get notebook with metadata
  ipcMain.handle('notebooks:getWithMetadata', async (_event, id: string) => {
    const notebook = await repo.getWithMetadata(createNotebookId(id));
    if (!notebook) return null;
    return {
      id: notebook.id,
      name: notebook.name,
      parentId: notebook.parentId,
      depth: notebook.depth,
      order: notebook.order,
      createdAt: notebook.createdAt,
      updatedAt: notebook.updatedAt,
      noteCount: notebook.noteCount,
      childCount: notebook.childCount,
    };
  });

  // Create notebook
  ipcMain.handle('notebooks:create', async (_event, input: { name: string; parentId?: string }) => {
    let parentDepth = 0;
    if (input.parentId) {
      const parent = await repo.get(createNotebookId(input.parentId));
      if (parent) {
        parentDepth = parent.depth;
      }
    }

    const nextOrder = await repo.getNextOrder(
      input.parentId ? createNotebookId(input.parentId) : null
    );

    const notebook = createNotebook({
      name: input.name,
      parentId: input.parentId ? createNotebookId(input.parentId) : null,
      parentDepth,
      order: nextOrder,
    });

    await repo.save(notebook);

    return {
      id: notebook.id,
      name: notebook.name,
      parentId: notebook.parentId,
      depth: notebook.depth,
      order: notebook.order,
      createdAt: notebook.createdAt,
      updatedAt: notebook.updatedAt,
    };
  });

  // Rename notebook
  ipcMain.handle('notebooks:rename', async (_event, id: string, name: string) => {
    const notebook = await repo.get(createNotebookId(id));
    if (!notebook) {
      throw new Error('Notebook not found');
    }

    const updated = renameNotebook(notebook, name);
    await repo.save(updated);

    return {
      id: updated.id,
      name: updated.name,
      parentId: updated.parentId,
      depth: updated.depth,
      order: updated.order,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  });

  // Move notebook (recursively updates children's depth)
  ipcMain.handle('notebooks:move', async (_event, id: string, newParentId: string | null) => {
    const notebook = await repo.get(createNotebookId(id));
    if (!notebook) {
      throw new Error('Notebook not found');
    }

    // Prevent circular reference: can't move a notebook into its own descendant
    if (newParentId) {
      let current = await repo.get(createNotebookId(newParentId));
      while (current && current.parentId) {
        if (current.parentId === notebook.id) {
          throw new Error('CIRCULAR_REFERENCE');
        }
        current = await repo.get(current.parentId);
      }
    }

    let newParentDepth = 0;
    if (newParentId) {
      const parent = await repo.get(createNotebookId(newParentId));
      if (parent) {
        newParentDepth = parent.depth;
      }
    }

    const result = moveNotebook(
      notebook,
      newParentId ? createNotebookId(newParentId) : null,
      newParentDepth
    );

    if (!result.success) {
      throw new Error(result.reason);
    }

    await repo.save(result.notebook);

    // Recursively update children's depth to match the new hierarchy
    const updateChildrenDepth = async (parentId: string, parentDepth: number) => {
      const children = await repo.getChildren(parentId as ReturnType<typeof createNotebookId>);
      for (const child of children) {
        const newChildDepth = parentDepth + 1;
        if (child.depth !== newChildDepth) {
          await repo.save({ ...child, depth: newChildDepth });
          await updateChildrenDepth(child.id, newChildDepth);
        }
      }
    };
    await updateChildrenDepth(result.notebook.id, result.notebook.depth);

    return {
      id: result.notebook.id,
      name: result.notebook.name,
      parentId: result.notebook.parentId,
      depth: result.notebook.depth,
      order: result.notebook.order,
      createdAt: result.notebook.createdAt,
      updatedAt: result.notebook.updatedAt,
    };
  });

  // Delete notebook
  ipcMain.handle('notebooks:delete', async (_event, id: string) => {
    const notebookId = createNotebookId(id);

    if (notebookId === INBOX_NOTEBOOK_ID) {
      throw new Error('Cannot delete Inbox notebook');
    }

    await repo.delete(notebookId);
    return { success: true };
  });

  // Reorder notebooks within a parent
  ipcMain.handle(
    'notebooks:reorder',
    async (_event, parentId: string | null, orderedIds: string[]) => {
      await repo.reorder(
        parentId ? createNotebookId(parentId) : null,
        orderedIds.map(id => createNotebookId(id))
      );
      return { success: true };
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Git Settings per Notebook
  // ═══════════════════════════════════════════════════════════════════════════

  // Enable git for a notebook
  ipcMain.handle('notebooks:enableGit', async (_event, notebookId: string) => {
    try {
      repo.enableGit(createNotebookId(notebookId));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enable git',
      };
    }
  });

  // Disable git for a notebook
  ipcMain.handle('notebooks:disableGit', async (_event, notebookId: string) => {
    try {
      repo.disableGit(createNotebookId(notebookId));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disable git',
      };
    }
  });

  // Check if git is enabled for a notebook
  ipcMain.handle('notebooks:isGitEnabled', async (_event, notebookId: string) => {
    try {
      const enabled = repo.isGitEnabled(createNotebookId(notebookId));
      return { success: true, enabled };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check git status',
      };
    }
  });

  // Get git settings for a notebook
  ipcMain.handle('notebooks:getGitSettings', async (_event, notebookId: string) => {
    try {
      const settings = repo.getGitSettings(createNotebookId(notebookId));
      return { success: true, settings };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get git settings',
      };
    }
  });

  // Toggle auto-commit for a notebook
  ipcMain.handle(
    'notebooks:setGitAutoCommit',
    async (_event, notebookId: string, enabled: boolean) => {
      try {
        repo.setGitAutoCommit(createNotebookId(notebookId), enabled);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to set auto-commit',
        };
      }
    }
  );

  // Get all git-enabled notebooks
  ipcMain.handle('notebooks:getGitEnabled', async () => {
    try {
      const notebooks = repo.getGitEnabledNotebooks();
      return {
        success: true,
        notebooks: notebooks.map(nb => ({
          id: nb.id,
          name: nb.name,
          parentId: nb.parentId,
          depth: nb.depth,
          order: nb.order,
          createdAt: nb.createdAt,
          updatedAt: nb.updatedAt,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get git-enabled notebooks',
      };
    }
  });
}
