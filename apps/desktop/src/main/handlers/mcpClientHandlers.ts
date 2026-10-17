/**
 * MCP Client IPC Handlers
 *
 * Lets Settings -> Integrations manage the external MCP servers Dripnex's
 * own agent is allowed to call tools from (the inverse of packages/mcp-server,
 * which lets external agents call Dripnex). Renderer-supplied server configs
 * are untrusted input: bounded and shape-checked at this boundary before
 * ever reaching a spawned child process.
 */

import { dialog } from 'electron';
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

/** True when enabling `config` would run a command that was never approved:
 * there's no stored config yet, it was previously disabled, or the launch
 * command/args/env changed since it was last approved. */
function needsApproval(previous: McpServerConfig | null, config: McpServerConfig): boolean {
  return (
    !previous ||
    !previous.enabled ||
    previous.command !== config.command ||
    JSON.stringify(previous.args) !== JSON.stringify(config.args) ||
    JSON.stringify(previous.env ?? {}) !== JSON.stringify(config.env ?? {})
  );
}

/** Native, main-process confirmation before spawning a renderer-supplied
 * command. The IPC boundary validates shape, not intent: a compromised
 * renderer (a plugin is a realistic source of renderer code execution) could
 * otherwise persist and launch an arbitrary process via mcpClient:save alone.
 * Throwing on decline is enough - the renderer already surfaces IPC
 * rejections as an error toast. */
async function confirmLaunch(config: McpServerConfig): Promise<void> {
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Cancel', 'Allow'],
    defaultId: 0,
    cancelId: 0,
    message: `Allow Dripnex to run this MCP server?`,
    detail: `${config.name}\n${[config.command, ...config.args].join(' ')}`,
  });
  if (response !== 1) throw new Error('MCP server was not approved');
}

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
      const previous = await configStorage.get(config.id);
      if (config.enabled && needsApproval(previous, config)) {
        await confirmLaunch(config);
      }
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
      // Only reconnect what's already enabled (approved via save). A
      // disabled config must go through mcpClient:save to flip enabled back
      // on - otherwise a renderer could save a changed command while
      // disabled and launch it here without ever hitting confirmLaunch.
      if (!config.enabled) throw new Error('MCP server is disabled');
      return manager.connect(config, toolRegistry);
    },
  });

  defineIpcHandler({
    channel: 'mcpClient:disconnect',
    args: z.tuple([IdSchema]),
    handler: async id => {
      await manager.disconnect(id);
      const config = await configStorage.get(id);
      if (config?.enabled) await configStorage.save({ ...config, enabled: false });
      return manager.getState(id);
    },
  });
}
