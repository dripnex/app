/**
 * Git IPC Handlers
 *
 * Handles git operations for git-backed notebooks.
 */

import { ipcMain } from 'electron';
import type { GitService } from './types.js';

export interface GitHandlerDeps {
  gitService: GitService;
}

export function registerGitHandlers(deps: GitHandlerDeps): void {
  const { gitService: git } = deps;

  // Initialize git repository for a notebook
  ipcMain.handle('git:init', async (_event, notebookId: string) => {
    try {
      const repoPath = await git.initRepository(notebookId);
      return {
        success: true,
        repoPath,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize git repository',
      };
    }
  });

  // Check if notebook has git repository
  ipcMain.handle('git:isRepo', async (_event, notebookId: string) => {
    try {
      const isRepo = await git.isGitRepository(notebookId);
      return { success: true, isRepo };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check git repository',
      };
    }
  });

  // Commit changes
  ipcMain.handle(
    'git:commit',
    async (_event, notebookId: string, message: string, files?: string[]) => {
      try {
        const sha = await git.commit(notebookId, message, files);
        return {
          success: true,
          sha,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to commit changes',
        };
      }
    }
  );

  // Get commit history
  ipcMain.handle('git:log', async (_event, notebookId: string, limit?: number) => {
    try {
      const commits = await git.log(notebookId, limit);
      return {
        success: true,
        commits,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get commit history',
      };
    }
  });

  // Get repository status
  ipcMain.handle('git:status', async (_event, notebookId: string) => {
    try {
      const status = await git.status(notebookId);
      return {
        success: true,
        status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get repository status',
      };
    }
  });

  // Checkout (revert to) a specific commit
  ipcMain.handle('git:checkout', async (_event, notebookId: string, commitSha: string) => {
    try {
      await git.checkout(notebookId, commitSha);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to checkout commit',
      };
    }
  });

  // Write note file to git repository
  ipcMain.handle(
    'git:writeNote',
    async (_event, notebookId: string, noteId: string, content: string) => {
      try {
        await git.writeNoteFile(notebookId, noteId, content);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to write note file',
        };
      }
    }
  );

  // Read note file from git repository
  ipcMain.handle('git:readNote', async (_event, notebookId: string, noteId: string) => {
    try {
      const content = await git.readNoteFile(notebookId, noteId);
      return {
        success: true,
        content,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read note file',
      };
    }
  });

  // Delete note file from git repository
  ipcMain.handle('git:deleteNote', async (_event, notebookId: string, noteId: string) => {
    try {
      await git.deleteNoteFile(notebookId, noteId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete note file',
      };
    }
  });
}
