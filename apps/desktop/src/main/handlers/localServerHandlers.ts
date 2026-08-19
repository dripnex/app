/**
 * Local HTTP API Server IPC Handlers
 *
 * Manages the local API server lifecycle and exposes status/token info
 * to the renderer (settings UI).
 */

import { dirname, join } from 'path';
import { app } from 'electron';
import { z } from 'zod';
import {
  createNoteId,
  createNotebook,
  createNotebookId,
  createNoteOperation,
  deleteNoteOperation,
  renameNotebook,
  setNotebookIcon,
  trashNoteOperation,
  updateNoteOperation,
} from '@dripnex/core';
import {
  ChangeLog,
  LocalServer,
  getOrCreateApiToken,
  type LocalServerHandlers,
} from '../services/localServer.js';
import { resolveMcpLaunch } from '../services/mcpLaunch.js';
import { writeMcpWritesConfig } from '../services/mcpWrites.js';
import { defineIpcHandler } from '../ipc/registry.js';
import type { SQLiteNoteRepository, SQLiteNotebookRepository, DataPaths } from './types.js';

// ============================================================================
// Types
// ============================================================================

export interface LocalServerHandlerDeps {
  noteRepository: SQLiteNoteRepository;
  notebookRepository: SQLiteNotebookRepository;
  dataPaths: DataPaths;
  noteToSnapshot: (note: {
    id: string;
    notebookId: string;
    content: string;
    title: string;
    isPinned: boolean;
    isDeleted: boolean;
    status: import('@dripnex/core').NoteStatus;
    metadata: {
      createdAt: string;
      updatedAt: string;
      tags: readonly string[];
      wordCount: number;
      archivedAt: string | null;
    };
  }) => {
    id: string;
    notebookId: string;
    content: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    tags: string[];
    wordCount: number;
    taskCount?: number;
    checkedTaskCount?: number;
    archivedAt: string | null;
    isArchived: boolean;
    isPinned: boolean;
    isDeleted: boolean;
    status: import('@dripnex/core').NoteStatus;
  };
}

// ============================================================================
// Module State
// ============================================================================

const server = new LocalServer();
const changeLog = new ChangeLog();
let apiToken: string | null = null;

// ============================================================================
// Registration
// ============================================================================

export function registerLocalServerHandlers(deps: LocalServerHandlerDeps): void {
  const { noteRepository: repo, notebookRepository, dataPaths, noteToSnapshot } = deps;
  changeLog.attach(join(dataPaths.root, 'changes.json'));
  void changeLog.load();

  // Build handler callbacks that bridge HTTP requests to the note repository
  const handlers: LocalServerHandlers = {
    async listNotes() {
      const notes = await repo.list();
      return notes
        .filter(n => !n.isDeleted)
        .map(n => ({
          id: n.id,
          title: n.title,
          excerpt: n.content.slice(0, 200).replace(/\n/g, ' '),
          updatedAt: n.metadata.updatedAt,
        }));
    },

    async getNote(id) {
      const note = await repo.get(createNoteId(id));
      if (!note) return null;
      const snap = noteToSnapshot(note);
      return {
        id: snap.id,
        title: snap.title,
        content: snap.content,
        notebookId: snap.notebookId,
        createdAt: snap.createdAt,
        updatedAt: snap.updatedAt,
        tags: snap.tags,
        wordCount: snap.wordCount,
        taskCount: snap.taskCount,
        checkedTaskCount: snap.checkedTaskCount,
        isPinned: snap.isPinned,
      };
    },

    async createNote(input) {
      const result = await createNoteOperation(input, repo);
      if (result.ok) {
        changeLog.record('note', result.data.id);
        return { ok: true, data: { id: result.data.id } };
      }
      return { ok: false, error: result.error };
    },

    async updateNote(id, content) {
      const noteId = createNoteId(id);
      const result = await updateNoteOperation({ id: noteId, content }, repo);
      if (result.ok) changeLog.record('note', id);
      return { ok: result.ok, error: result.ok ? undefined : result.error };
    },

    async searchNotes(query) {
      const notes = await repo.search(query, 50);
      return notes.map(n => ({
        id: n.id,
        title: n.title,
        excerpt: n.content.slice(0, 200).replace(/\n/g, ' '),
        updatedAt: n.metadata.updatedAt,
      }));
    },

    async getNoteCount() {
      return repo.count();
    },

    getAppVersion() {
      return app.getVersion();
    },

    async listNotebooks() {
      const notebooks = await notebookRepository.getAll();
      return notebooks.map(nb => ({
        id: nb.id,
        name: nb.name,
        parentId: nb.parentId,
        icon: nb.icon,
      }));
    },

    async listTags() {
      return repo.listTags();
    },

    async deleteNote(id, permanent) {
      const noteId = createNoteId(id);
      const result = permanent
        ? await deleteNoteOperation({ id: noteId }, repo)
        : await trashNoteOperation({ id: noteId }, repo);
      if (result.ok) changeLog.record('note', id, true);
      return { ok: result.ok, error: result.ok ? undefined : result.error };
    },

    async createNotebook(input) {
      try {
        let parentDepth = 0;
        if (input.parentId) {
          const parent = await notebookRepository.get(createNotebookId(input.parentId));
          if (parent) parentDepth = parent.depth;
        }
        const nextOrder = await notebookRepository.getNextOrder(
          input.parentId ? createNotebookId(input.parentId) : null
        );
        const notebook = createNotebook({
          name: input.name,
          parentId: input.parentId ? createNotebookId(input.parentId) : null,
          parentDepth,
          order: nextOrder,
        });
        await notebookRepository.save(notebook);
        changeLog.record('book', notebook.id);
        return { ok: true, data: { id: notebook.id } };
      } catch (err) {
        return { ok: false, error: err };
      }
    },

    async deleteNotebook(id) {
      try {
        await notebookRepository.delete(createNotebookId(id));
        changeLog.record('book', id, true);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err };
      }
    },

    async updateNotebook(id, patch) {
      try {
        const notebook = await notebookRepository.get(createNotebookId(id));
        if (!notebook) return { ok: false, error: 'not found' };
        let next = notebook;
        if (typeof patch.name === 'string' && patch.name.trim()) {
          next = renameNotebook(next, patch.name);
        }
        if (patch.icon !== undefined) {
          next = setNotebookIcon(next, patch.icon);
        }
        await notebookRepository.save(next);
        changeLog.record('book', id);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err };
      }
    },

    async putTag(name, patch) {
      try {
        const current = name.trim();
        if (!current) return { ok: false, error: 'empty name' };
        if (patch.color !== undefined) {
          repo.setTagColor(current, patch.color);
        } else if (!patch.newName) {
          repo.setTagColor(current, null);
        }
        if (patch.newName && patch.newName.trim() && patch.newName.trim() !== current) {
          const renamed = repo.renameTag(current, patch.newName);
          if (!renamed.ok) return { ok: false, error: renamed.error };
          changeLog.record('tag', patch.newName.trim().toLowerCase());
        } else {
          changeLog.record('tag', current.toLowerCase());
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err };
      }
    },

    getChanges(since) {
      return changeLog.since(since);
    },
  };

  defineIpcHandler({
    channel: 'localServer:start',
    args: z.tuple([z.number().int().min(1).max(65535).optional()]),
    handler: async port => {
      try {
        if (server.isRunning()) return { ok: true, port: server.getPort() };
        apiToken = await getOrCreateApiToken(dataPaths.root);
        await server.start(port, apiToken, handlers);
        return { ok: true, port: server.getPort() };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  });

  defineIpcHandler({
    channel: 'localServer:stop',
    args: z.tuple([]),
    handler: async () => {
      try {
        await server.stop();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  });

  defineIpcHandler({
    channel: 'localServer:status',
    args: z.tuple([]),
    handler: () => ({
      running: server.isRunning(),
      port: server.getPort(),
    }),
  });

  defineIpcHandler({
    channel: 'localServer:getToken',
    args: z.tuple([]),
    handler: async () => {
      try {
        if (!apiToken) {
          apiToken = await getOrCreateApiToken(dataPaths.root);
        }
        return { ok: true, value: apiToken };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  });

  defineIpcHandler({
    channel: 'localServer:connectionInfo',
    args: z.tuple([]),
    handler: async () => {
      try {
        if (!apiToken) {
          apiToken = await getOrCreateApiToken(dataPaths.root);
        }
        const launch = resolveMcpLaunch();
        const port = server.getPort();
        return {
          ok: true,
          running: server.isRunning(),
          port,
          url: `http://127.0.0.1:${port}`,
          token: apiToken,
          dbPath: dataPaths.database,
          mcpCommand: launch?.command ?? null,
          mcpArgs: launch?.args ?? null,
        };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  });

  defineIpcHandler({
    channel: 'localServer:setWrites',
    args: z.tuple([z.boolean()]),
    handler: async writes => {
      try {
        const override = process.env.DRIPNEX_DB_PATH;
        const dir = override ? dirname(override) : dataPaths.root;
        await writeMcpWritesConfig(dir, writes);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  });
}

/**
 * Pre-initialise the API bearer token (called from main index).
 * The actual server start is controlled by settings — the renderer
 * will call localServer:start if the setting is enabled.
 */
export async function initApiToken(dataPaths: DataPaths): Promise<void> {
  apiToken = await getOrCreateApiToken(dataPaths.root);
}

/** Stop the server on app quit */
export async function stopLocalServer(): Promise<void> {
  await server.stop();
}
