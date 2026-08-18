/**
 * Notebook IPC Handlers
 *
 * Handles notebook CRUD, git settings per notebook, and reordering.
 */

import { z } from 'zod';
import {
  createNotebookId,
  createNotebook,
  createTemplatesNotebook,
  renameNotebook,
  moveNotebook,
  INBOX_NOTEBOOK_ID,
  TEMPLATES_NOTEBOOK_ID,
} from '@dripnex/core';
import { defineIpcHandler } from '../ipc/registry.js';
import type { SQLiteNotebookRepository } from './types.js';

export interface NotebookHandlerDeps {
  notebookRepository: SQLiteNotebookRepository;
}

const IdSchema = z.string().min(1).max(128);
const NameSchema = z.string().min(1).max(256);

export function registerNotebookHandlers(deps: NotebookHandlerDeps): void {
  const { notebookRepository: repo } = deps;

  const serialize = (nb: {
    id: string;
    name: string;
    parentId: string | null;
    depth: number;
    order: number;
    createdAt: string;
    updatedAt: string;
  }) => ({
    id: nb.id,
    name: nb.name,
    parentId: nb.parentId,
    depth: nb.depth,
    order: nb.order,
    createdAt: nb.createdAt,
    updatedAt: nb.updatedAt,
  });

  defineIpcHandler({
    channel: 'notebooks:list',
    args: z.tuple([]),
    handler: async () => {
      const notebooks = await repo.getAll();
      return notebooks.map(serialize);
    },
  });

  defineIpcHandler({
    channel: 'notebooks:tree',
    args: z.tuple([]),
    handler: () => repo.getTree(),
  });

  defineIpcHandler({
    channel: 'notebooks:get',
    args: z.tuple([IdSchema]),
    handler: async id => {
      const notebook = await repo.get(createNotebookId(id));
      return notebook ? serialize(notebook) : null;
    },
  });

  defineIpcHandler({
    channel: 'notebooks:getWithMetadata',
    args: z.tuple([IdSchema]),
    handler: async id => {
      const notebook = await repo.getWithMetadata(createNotebookId(id));
      if (!notebook) return null;
      return {
        ...serialize(notebook),
        noteCount: notebook.noteCount,
        childCount: notebook.childCount,
      };
    },
  });

  defineIpcHandler({
    channel: 'notebooks:create',
    args: z.tuple([
      z.object({
        name: NameSchema,
        parentId: IdSchema.optional(),
      }),
    ]),
    handler: async input => {
      let parentDepth = 0;
      if (input.parentId) {
        const parent = await repo.get(createNotebookId(input.parentId));
        if (parent) parentDepth = parent.depth;
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
      return serialize(notebook);
    },
  });

  defineIpcHandler({
    channel: 'notebooks:ensureTemplates',
    args: z.tuple([]),
    handler: async () => {
      const existing = await repo.get(TEMPLATES_NOTEBOOK_ID);
      if (existing) return serialize(existing);
      const notebook = createTemplatesNotebook();
      await repo.save(notebook);
      return serialize(notebook);
    },
  });

  defineIpcHandler({
    channel: 'notebooks:rename',
    args: z.tuple([IdSchema, NameSchema]),
    handler: async (id, name) => {
      const notebook = await repo.get(createNotebookId(id));
      if (!notebook) {
        throw new Error('Notebook not found');
      }
      const updated = renameNotebook(notebook, name);
      await repo.save(updated);
      return serialize(updated);
    },
  });

  defineIpcHandler({
    channel: 'notebooks:move',
    args: z.tuple([IdSchema, IdSchema.nullable()]),
    handler: async (id, newParentId) => {
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
        if (parent) newParentDepth = parent.depth;
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

      return serialize(result.notebook);
    },
  });

  defineIpcHandler({
    channel: 'notebooks:delete',
    args: z.tuple([IdSchema]),
    handler: async id => {
      const notebookId = createNotebookId(id);
      if (notebookId === INBOX_NOTEBOOK_ID || notebookId === TEMPLATES_NOTEBOOK_ID) {
        throw new Error('Cannot delete reserved notebook');
      }
      await repo.delete(notebookId);
      return { success: true };
    },
  });

  defineIpcHandler({
    channel: 'notebooks:reorder',
    args: z.tuple([IdSchema.nullable(), z.array(IdSchema).max(10000)]),
    handler: async (parentId, orderedIds) => {
      await repo.reorder(
        parentId ? createNotebookId(parentId) : null,
        orderedIds.map(id => createNotebookId(id))
      );
      return { success: true };
    },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Git Settings per Notebook
  // ═══════════════════════════════════════════════════════════════════════════

  defineIpcHandler({
    channel: 'notebooks:enableGit',
    args: z.tuple([IdSchema]),
    handler: notebookId => {
      try {
        repo.enableGit(createNotebookId(notebookId));
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to enable git',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'notebooks:disableGit',
    args: z.tuple([IdSchema]),
    handler: notebookId => {
      try {
        repo.disableGit(createNotebookId(notebookId));
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to disable git',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'notebooks:isGitEnabled',
    args: z.tuple([IdSchema]),
    handler: notebookId => {
      try {
        const enabled = repo.isGitEnabled(createNotebookId(notebookId));
        return { success: true, enabled };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to check git status',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'notebooks:getGitSettings',
    args: z.tuple([IdSchema]),
    handler: notebookId => {
      try {
        const settings = repo.getGitSettings(createNotebookId(notebookId));
        return { success: true, settings };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get git settings',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'notebooks:setGitAutoCommit',
    args: z.tuple([IdSchema, z.boolean()]),
    handler: (notebookId, enabled) => {
      try {
        repo.setGitAutoCommit(createNotebookId(notebookId), enabled);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to set auto-commit',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'notebooks:getGitEnabled',
    args: z.tuple([]),
    handler: () => {
      try {
        const notebooks = repo.getGitEnabledNotebooks();
        return { success: true, notebooks: notebooks.map(serialize) };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get git-enabled notebooks',
        };
      }
    },
  });
}
