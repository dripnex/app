/**
 * Share IPC Handlers
 *
 * Handles sharing notes to the web via the API.
 * Auto-copies the share URL to clipboard.
 */

import { ipcMain, clipboard } from 'electron';
import type { ApiClient } from '../services/apiClient.js';

export interface ShareHandlerDependencies {
  apiClient: ApiClient;
}

export function registerShareHandlers(deps: ShareHandlerDependencies): void {
  const { apiClient } = deps;

  // Create or update a shared note
  ipcMain.handle(
    'share:create',
    async (
      _event,
      input: { noteId: string; title: string; content: string }
    ): Promise<{ success: boolean; url?: string; slug?: string; error?: string }> => {
      try {
        const result = await apiClient.shareNote(input);
        clipboard.writeText(result.url);
        return { success: true, url: result.url, slug: result.slug };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to share note',
        };
      }
    }
  );

  // Delete a shared note
  ipcMain.handle(
    'share:delete',
    async (_event, slug: string): Promise<{ success: boolean; error?: string }> => {
      try {
        await apiClient.unshareNote(slug);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to unshare note',
        };
      }
    }
  );
}
