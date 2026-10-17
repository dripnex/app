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

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import type { ToolRegistry, ToolResult } from '@dripnex/ai-core';
import { getLogger } from '../logger.js';
import type { McpServerConfig } from '../services/mcpClientConfigStorage.js';

const execFileAsync = promisify(execFile);

/** Electron apps launched from the Dock/Finder inherit a minimal PATH (no
 * Homebrew, no npm global bin), so `npx some-mcp-server` can fail with
 * `ENOENT` even though the same command works in a terminal. Resolve the
 * user's actual login-shell PATH once and reuse it for every server. */
let cachedLoginShellPath: string | undefined;

/** getLogger() throws if called before initLogger() (notably in unit tests) -
 * never let a logging attempt itself turn a recoverable failure into a crash. */
function safeWarn(fields: Record<string, unknown>, message: string): void {
  try {
    getLogger().warn(fields, message);
  } catch {
    // Logger not ready; losing this one log line isn't worth crashing for.
  }
}

async function resolveLoginShellPath(): Promise<string | undefined> {
  if (cachedLoginShellPath !== undefined) return cachedLoginShellPath;
  const shell = process.env.SHELL || '/bin/zsh';
  try {
    const { stdout } = await execFileAsync(shell, ['-ilc', 'echo -n "$PATH"'], {
      timeout: 5000,
    });
    cachedLoginShellPath = stdout.trim() || undefined;
  } catch (error) {
    safeWarn({ error }, 'Could not resolve login-shell PATH for MCP servers');
    cachedLoginShellPath = undefined;
  }
  return cachedLoginShellPath;
}

/** SDK default env (a safe, narrow allowlist) + the real login PATH + the
 * user's own config.env, in that order so an explicit PATH in config.env
 * still wins. */
async function buildServerEnv(extra?: Record<string, string>): Promise<Record<string, string>> {
  const base = getDefaultEnvironment();
  const loginPath = await resolveLoginShellPath();
  return { ...base, ...(loginPath ? { PATH: loginPath } : {}), ...(extra ?? {}) };
}

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
    // Cancel/close whatever is currently connecting or connected for this id
    // *before* starting a new one, so two overlapping connects (startup
    // auto-connect racing a manual "Connect", or two quick clicks) can't
    // both end up registering tools under the same namespaced names.
    await this.disconnect(config.id);

    this.states.set(config.id, { serverId: config.id, status: 'connecting', toolCount: 0 });

    // Set once, just below, then never reassigned - a `const` alias so
    // closures (onerror/onclose) and the catch block below can reference it
    // without TypeScript widening it back to `Client | undefined` on every
    // use (which a reassignable `let` captured by a closure would).
    let clientOrUndefined: Client | undefined;

    try {
      const client = new Client({ name: 'dripnex', version: '1.0.0' }, { capabilities: {} });
      clientOrUndefined = client;
      const isCurrent = () => this.connections.get(config.id)?.client === client;
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: await buildServerEnv(config.env),
      });

      // Track the client as soon as it exists, not only once listTools()
      // resolves. connect()/listTools() can take seconds (e.g. npx
      // downloading a package); without this, disconnect() called during
      // that window finds nothing to close and the connection completes
      // anyway.
      this.connections.set(config.id, { client, unregister: [] });

      client.onerror = error => {
        getLogger().error({ serverId: config.id, error: error.message }, 'MCP client error');
        if (isCurrent()) {
          this.states.set(config.id, {
            serverId: config.id,
            status: 'error',
            toolCount: 0,
            error: error.message,
          });
        }
      };
      client.onclose = () => {
        // Only this client's own close should tear down its entry - a stale
        // handler from a replaced/cancelled connection must not touch the
        // connection that replaced it.
        if (!isCurrent()) return;
        const current = this.connections.get(config.id);
        current?.unregister.forEach(fn => fn());
        this.connections.delete(config.id);
        if (this.states.get(config.id)?.status !== 'error') {
          this.states.set(config.id, { serverId: config.id, status: 'disconnected', toolCount: 0 });
        }
      };

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

      if (!isCurrent()) {
        // We were disconnected (or replaced by a newer connect()) while this
        // one was still connecting. Nobody wants these tools or this process.
        unregister.forEach(fn => fn());
        try {
          await client.close();
        } catch {
          // Already closing/closed.
        }
        return this.getState(config.id);
      }

      const current = this.connections.get(config.id);
      if (current) current.unregister = unregister;
      const state: McpConnectionState = {
        serverId: config.id,
        status: 'connected',
        toolCount: tools.length,
      };
      this.states.set(config.id, state);
      return state;
    } catch (error) {
      // Capture this *before* closing the client: close() fires its own
      // onclose handler synchronously, which would otherwise race this catch
      // block to decide what the final state should be (and lose, since
      // onclose only knows how to set 'disconnected', never the real error).
      const wasCurrent = this.connections.get(config.id)?.client === clientOrUndefined;

      // client.connect() already starts the child process - close it even on
      // failure, or a server with no tools capability (or any other startup
      // error) leaks an orphaned process on every retry. clientOrUndefined is
      // unset only if `new Client(...)` itself threw, before any process
      // could have started.
      if (clientOrUndefined) {
        try {
          await clientOrUndefined.close();
        } catch {
          // Already closing/closed.
        }
      }
      if (!wasCurrent) {
        // A newer connect()/disconnect() already owns this id's state.
        return this.getState(config.id);
      }
      this.connections.delete(config.id);
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
