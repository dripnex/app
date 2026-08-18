import { z } from 'zod';
import { defineIpcHandler } from '../../ipc/registry.js';
import { createGitHubService, type GitHubNoteSink } from './service.js';

export function registerGitHubHandlers(deps: { dataDir: string; notes?: GitHubNoteSink }): void {
  const github = createGitHubService(deps.dataDir, deps.notes);

  defineIpcHandler({
    channel: 'integrations:github:status',
    args: z.tuple([]),
    handler: () => github.status(),
  });

  defineIpcHandler({
    channel: 'integrations:github:connect',
    args: z.tuple([z.string().max(256).optional().nullable()]),
    handler: async token => {
      try {
        const result = await github.connect(token);
        return { success: true as const, login: result.login };
      } catch (error) {
        return {
          success: false as const,
          error: error instanceof Error ? error.message : 'Could not connect to GitHub.',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'integrations:github:disconnect',
    args: z.tuple([]),
    handler: async () => {
      await github.disconnect();
      return { success: true as const };
    },
  });

  defineIpcHandler({
    channel: 'integrations:github:importIssue',
    args: z.tuple([z.string().max(512)]),
    handler: async url => {
      try {
        const issue = await github.importIssue(url);
        return { success: true as const, ...issue };
      } catch (error) {
        return {
          success: false as const,
          error: error instanceof Error ? error.message : 'Could not import that issue.',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'integrations:github:listWatchers',
    args: z.tuple([]),
    handler: () => github.listWatchers(),
  });

  defineIpcHandler({
    channel: 'integrations:github:addWatcher',
    args: z.tuple([z.string().min(3).max(512)]),
    handler: raw => {
      try {
        return { success: true as const, watcher: github.addWatcher(raw) };
      } catch (error) {
        return {
          success: false as const,
          error: error instanceof Error ? error.message : 'Could not add that watcher.',
        };
      }
    },
  });

  defineIpcHandler({
    channel: 'integrations:github:removeWatcher',
    args: z.tuple([z.string().min(1).max(128)]),
    handler: id => {
      github.removeWatcher(id);
      return { success: true as const };
    },
  });

  defineIpcHandler({
    channel: 'integrations:github:pullWatchers',
    args: z.tuple([z.string().min(1).max(128).nullable()]),
    handler: async watcherId => {
      try {
        const result = await github.pullWatchers(watcherId ?? undefined);
        return { success: true as const, ...result };
      } catch (error) {
        return {
          success: false as const,
          error: error instanceof Error ? error.message : 'Pull failed.',
        };
      }
    },
  });
}
