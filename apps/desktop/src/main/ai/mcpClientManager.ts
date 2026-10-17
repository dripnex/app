/**
 * MCP Client Manager
 *
 * Lets Dripnex's own in-app agent call tools from external MCP servers the
 * user configures (Settings -> Integrations -> MCP Servers), instead of
 * only being an MCP *server* itself (see packages/mcp-server). Connects over
 * stdio only for v1 - no remote/hosted servers, matching "notes are
 * local-first."
 *
 * Every tool discovered from a connected server is registered into the
 * shared ToolRegistry with requiresConfirmation: true, always - external
 * servers are less trusted than built-in tools or a connected GitHub
 * account, so there is no auto-exec path for them, even for
 * read-looking tools.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { ToolRegistry, ToolResult } from '@dripnex/ai-core';
import { getLogger } from '../logger.js';
import type { McpServerConfig } from '../services/mcpClientConfigStorage.js';

export type McpConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface McpConnectionState {
  serverId: string;
  status: McpConnectionStatus;
  toolCount: number;
  error?: string;
}

interface McpToolLike {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

interface McpCallToolResultLike {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

/** Tool names must be safe for every LLM provider's tool-name grammar
 * (alphanumeric, underscore, hyphen). MCP server ids and tool names are
 * user/third-party supplied, so both get sanitized independently. */
function sanitizeForToolName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function namespaceToolName(serverId: string, toolName: string): string {
  return `mcp_${sanitizeForToolName(serverId)}_${sanitizeForToolName(toolName)}`;
}

export function mapMcpCallResult(result: McpCallToolResultLike): ToolResult {
  const blocks = result.content ?? [];
  const textParts = blocks
    .map(block => (block.type === 'text' ? (block.text ?? '') : `[${block.type} omitted]`))
    .filter(Boolean);
  const content = textParts.join('\n') || '(empty result)';
  if (result.isError) {
    return { ok: false, content, error: content };
  }
  return { ok: true, content };
}

export class McpClientManager {
  private readonly connections = new Map<
    string,
    { client: Client; unregister: Array<() => void> }
  >();
  private readonly states = new Map<string, McpConnectionState>();

  getState(serverId: string): McpConnectionState {
    return this.states.get(serverId) ?? { serverId, status: 'disconnected', toolCount: 0 };
  }

  listStates(): McpConnectionState[] {
    return Array.from(this.states.values());
  }

  isConnected(serverId: string): boolean {
    return this.connections.has(serverId);
  }

  async connect(config: McpServerConfig, registry: ToolRegistry): Promise<McpConnectionState> {
    await this.disconnect(config.id);

    this.states.set(config.id, { serverId: config.id, status: 'connecting', toolCount: 0 });

    const client = new Client({ name: 'dripnex', version: '1.0.0' }, { capabilities: {} });
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env,
    });

    client.onerror = error => {
      getLogger().error({ serverId: config.id, error: error.message }, 'MCP client error');
      this.states.set(config.id, {
        serverId: config.id,
        status: 'error',
        toolCount: 0,
        error: error.message,
      });
    };
    client.onclose = () => {
      const current = this.connections.get(config.id);
      if (current) {
        current.unregister.forEach(fn => fn());
        this.connections.delete(config.id);
      }
      if (this.states.get(config.id)?.status !== 'error') {
        this.states.set(config.id, { serverId: config.id, status: 'disconnected', toolCount: 0 });
      }
    };

    try {
      await client.connect(transport);
      const { tools } = await client.listTools();
      // Register tools one at a time so a single name collision (two tools
      // that sanitize to the same name) only drops that tool, instead of
      // aborting the whole connection and leaking the already-registered
      // ones.
      const unregister: Array<() => void> = [];
      for (const tool of tools) {
        try {
          unregister.push(registerMcpTool(config.id, tool, client, registry));
        } catch (error) {
          getLogger().error(
            { serverId: config.id, tool: tool.name, error },
            'Failed to register MCP tool (likely a name collision)'
          );
        }
      }
      this.connections.set(config.id, { client, unregister });
      const state: McpConnectionState = {
        serverId: config.id,
        status: 'connected',
        toolCount: tools.length,
      };
      this.states.set(config.id, state);
      return state;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect';
      const state: McpConnectionState = {
        serverId: config.id,
        status: 'error',
        toolCount: 0,
        error: message,
      };
      this.states.set(config.id, state);
      return state;
    }
  }

  async disconnect(serverId: string): Promise<void> {
    const existing = this.connections.get(serverId);
    if (!existing) return;
    this.connections.delete(serverId);
    existing.unregister.forEach(fn => fn());
    try {
      await existing.client.close();
    } catch {
      // Already closing/closed - nothing more to do.
    }
    this.states.set(serverId, { serverId, status: 'disconnected', toolCount: 0 });
  }

  async disconnectAll(): Promise<void> {
    await Promise.all(Array.from(this.connections.keys()).map(id => this.disconnect(id)));
  }
}

function registerMcpTool(
  serverId: string,
  tool: McpToolLike,
  client: Client,
  registry: ToolRegistry
): () => void {
  const name = namespaceToolName(serverId, tool.name);
  return registry.register({
    name,
    description: `[MCP: ${serverId}] ${tool.description ?? tool.name}`,
    parameters: tool.inputSchema,
    requiresConfirmation: true,
    execute: async args => {
      try {
        const result = await client.callTool({ name: tool.name, arguments: args });
        return mapMcpCallResult(result as McpCallToolResultLike);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'MCP tool call failed';
        return { ok: false, content: message, error: message };
      }
    },
  });
}
