/**
 * Git IPC Handlers
 *
 * Handles git operations for git-backed notebooks.
 */

import { z } from 'zod';
import { defineIpcHandler } from '../ipc/registry.js';
import type { GitService } from './types.js';

export interface GitHandlerDeps {
  gitService: GitService;
}

// Notebook/note IDs are UUIDs (crypto.randomUUID) or safe slugs like 'inbox'.
// Restrict the charset: these values flow into path.join() inside GitService,
// so an unconstrained string (e.g. "../../..") would enable path traversal.
const IdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/, 'ID must be alphanumeric (letters, digits, _ or -)');
// SHAs are hex; allow short-SHAs (≥7) up to full 40-char.
const ShaSchema = z
  .string()
  .min(7)
  .max(40)
  .regex(/^[a-f0-9]+$/i);
// Commit messages can be long but not absurd.
const CommitMessageSchema = z.string().min(1).max(8192);
// Note file content cap matches the share payload cap.
const NoteContentSchema = z.string().max(1024 * 1024);

export function registerGitHandlers(deps: GitHandlerDeps): void {
  const { gitService: git } = deps;

  defineIpcHandler({
    channel: 'git:init',
    args: z.tuple([IdSchema]),
    handler: async notebookId => {
      try {
        const repoPath = await git.initRepository(notebookId);
        return { success: true, repoPath };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to initialize git repository',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'git:isRepo',
    args: z.tuple([IdSchema]),
    handler: async notebookId => {
      try {
        const isRepo = await git.isGitRepository(notebookId);
        return { success: true, isRepo };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to check git repository',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'git:commit',
    args: z.tuple([
      IdSchema,
      CommitMessageSchema,
      z.array(z.string().max(1024)).max(10000).optional(),
    ]),
    handler: async (notebookId, message, files) => {
      try {
        const sha = await git.commit(notebookId, message, files);
        return { success: true, sha };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to commit changes',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'git:log',
    args: z.tuple([IdSchema, z.number().int().positive().max(10000).optional()]),
    handler: async (notebookId, limit) => {
      try {
        const commits = await git.log(notebookId, limit);
        return { success: true, commits };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get commit history',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'git:status',
    args: z.tuple([IdSchema]),
    handler: async notebookId => {
      try {
        const status = await git.status(notebookId);
        return { success: true, status };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get repository status',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'git:checkout',
    args: z.tuple([IdSchema, ShaSchema]),
    handler: async (notebookId, commitSha) => {
      try {
        await git.checkout(notebookId, commitSha);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to checkout commit',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'git:writeNote',
    args: z.tuple([IdSchema, IdSchema, NoteContentSchema]),
    handler: async (notebookId, noteId, content) => {
      try {
        await git.writeNoteFile(notebookId, noteId, content);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to write note file',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'git:readNote',
    args: z.tuple([IdSchema, IdSchema]),
    handler: async (notebookId, noteId) => {
      try {
        const content = await git.readNoteFile(notebookId, noteId);
        return { success: true, content };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to read note file',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'git:deleteNote',
    args: z.tuple([IdSchema, IdSchema]),
    handler: async (notebookId, noteId) => {
      try {
        await git.deleteNoteFile(notebookId, noteId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete note file',
        };
      }
    },
  });
}
