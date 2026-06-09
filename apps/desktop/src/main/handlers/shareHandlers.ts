/**
 * Share IPC Handlers
 *
 * Handles sharing notes to the web via the API.
 * Auto-copies the share URL to clipboard.
 */

import { clipboard } from 'electron';
import { z } from 'zod';
import { defineIpcHandler } from '../ipc/registry.js';
import type { ApiClient } from '../services/apiClient.js';

export interface ShareHandlerDependencies {
  apiClient: ApiClient;
}

// Note content can be quite long; cap at 1 MiB which is well above any
// realistic note and well below "this looks like an attack payload".
const SharePayloadSchema = z.object({
  noteId: z.string().min(1).max(128),
  title: z.string().max(512),
  content: z.string().max(1024 * 1024),
  tags: z.array(z.string().max(64)).max(64).optional(),
  backlinks: z
    .array(z.object({ noteId: z.string().min(1).max(128), title: z.string().max(512) }))
    .max(256)
    .optional(),
  wordCount: z.number().int().nonnegative().optional(),
  notebookName: z.string().max(256).optional(),
});

const SlugSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);

export function registerShareHandlers(deps: ShareHandlerDependencies): void {
  const { apiClient } = deps;

  defineIpcHandler({
    channel: 'share:create',
    args: z.tuple([SharePayloadSchema]),
    handler: async (
      input
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
    },
  });

  defineIpcHandler({
    channel: 'share:delete',
    args: z.tuple([SlugSchema]),
    handler: async (slug): Promise<{ success: boolean; error?: string }> => {
      try {
        await apiClient.unshareNote(slug);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to unshare note',
        };
      }
    },
  });
}
