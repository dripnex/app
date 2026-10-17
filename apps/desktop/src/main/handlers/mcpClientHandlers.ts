/**
 * MCP Client IPC Handlers
 *
 * Lets Settings -> Integrations manage the external MCP servers Dripnex's
 * own agent is allowed to call tools from (the inverse of packages/mcp-server,
 * which lets external agents call Dripnex). Renderer-supplied server configs
 * are untrusted input: bounded and shape-checked at this boundary before
 * ever reaching a spawned child process.
 */

import { z } from 'zod';
import type { ToolRegistry } from '@dripnex/ai-core';
import { defineIpcHandler } from '../ipc/registry.js';
import type { McpServerConfig } from '../services/mcpClientConfigStorage.js';
import type { McpClientConfigStorage, McpClientManager } from './types.js';

export interface McpClientHandlerDeps {
  configStorage: McpClientConfigStorage;
  manager: McpClientManager;
  toolRegistry: ToolRegistry;
}

const IdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Server id must be alphanumeric (with _ or -)');

const ServerConfigSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(128),
  command: z.string().min(1).max(512),
  args: z.array(z.string().max(1024)).max(32),
  env: z.record(z.string().max(128), z.string().max(4096)).optional(),
  enabled: z.boolean(),
}) satisfies z.ZodType<McpServerConfig>;

export function registerMcpClientHandlers(deps: McpClientHandlerDeps): void {
  const { configStorage, manager, toolRegistry } = deps;

  defineIpcHandler({
    channel: 'mcpClient:list',
    args: z.tuple([]),
    handler: async () => {
      const configs = await configStorage.list();
      return configs.map(config => ({ config, state: manager.getState(config.id) }));
    },
  });

  defineIpcHandler({
    channel: 'mcpClient:save',
    args: z.tuple([ServerConfigSchema]),
    handler: async config => {
      await configStorage.save(config);
      if (!config.enabled) {
        await manager.disconnect(config.id);
        return manager.getState(config.id);
      }
      return manager.connect(config, toolRegistry);
    },
  });

  defineIpcHandler({
    channel: 'mcpClient:remove',
    args: z.tuple([IdSchema]),
    handler: async id => {
      await manager.disconnect(id);
      await configStorage.remove(id);
    },
  });

  defineIpcHandler({
    channel: 'mcpClient:connect',
    args: z.tuple([IdSchema]),
    handler: async id => {
      const config = await configStorage.get(id);
      if (!config) throw new Error(`No MCP server configured with id "${id}"`);
      return manager.connect(config, toolRegistry);
    },
  });

  defineIpcHandler({
    channel: 'mcpClient:disconnect',
    args: z.tuple([IdSchema]),
    handler: async id => {
      await manager.disconnect(id);
      return manager.getState(id);
    },
  });
}
