/**
 * MCP Client Preload API
 *
 * Exposes control over the external MCP servers Dripnex's own agent can call
 * tools from (the inverse of the localServer/MCP-server API: that one lets
 * other agents call Dripnex, this one lets Dripnex call other agents' tools).
 */

import { ipcRenderer } from 'electron';

export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

export type McpConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface McpConnectionState {
  serverId: string;
  status: McpConnectionStatus;
  toolCount: number;
  error?: string;
}

export interface McpServerEntry {
  config: McpServerConfig;
  state: McpConnectionState;
}

export interface McpClientAPI {
  list: () => Promise<McpServerEntry[]>;
  save: (config: McpServerConfig) => Promise<McpConnectionState>;
  remove: (id: string) => Promise<void>;
  connect: (id: string) => Promise<McpConnectionState>;
  disconnect: (id: string) => Promise<McpConnectionState>;
}

export function createMcpClientApi(): McpClientAPI {
  return {
    list: () => ipcRenderer.invoke('mcpClient:list'),
    save: config => ipcRenderer.invoke('mcpClient:save', config),
    remove: id => ipcRenderer.invoke('mcpClient:remove', id),
    connect: id => ipcRenderer.invoke('mcpClient:connect', id),
    disconnect: id => ipcRenderer.invoke('mcpClient:disconnect', id),
  };
}
