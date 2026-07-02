/**
 * Local HTTP API Server IPC Handlers
 *
 * Manages the local API server lifecycle and exposes status/token info
 * to the renderer (settings UI).
 */

import { app } from 'electron';
import { z } from 'zod';
import { createNoteId, createNoteOperation, updateNoteOperation } from '@dripnex/core';
import {
  LocalServer,
  getOrCreateApiToken,
  type LocalServerHandlers,
} from '../services/localServer.js';
import { defineIpcHandler } from '../ipc/registry.js';
import type { SQLiteNoteRepository, DataPaths } from './types.js';

// ============================================================================
// Types
// ============================================================================

export interface LocalServerHandlerDeps {
  noteRepository: SQLiteNoteRepository;
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
let apiToken: string | null = null;

// ============================================================================
// Registration
// ============================================================================

export function registerLocalServerHandlers(deps: LocalServerHandlerDeps): void {
  const { noteRepository: repo, dataPaths, noteToSnapshot } = deps;

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
        isPinned: snap.isPinned,
      };
    },

    async createNote(input) {
      const result = await createNoteOperation(input, repo);
      if (result.ok) {
        return { ok: true, data: { id: result.data.id } };
      }
      return { ok: false, error: result.error };
    },

    async updateNote(id, content) {
      const noteId = createNoteId(id);
      const result = await updateNoteOperation({ id: noteId, content }, repo);
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
