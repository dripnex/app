/**
 * Local Server Preload API
 *
 * Exposes local HTTP API server controls to the renderer.
 */

import { ipcRenderer } from 'electron';

export interface LocalServerConnectionInfo {
  running: boolean;
  port: number;
  url: string;
  token: string;
  dbPath: string;
  mcpCommand: string | null;
  mcpArgs: string[] | null;
}

export interface LocalServerAPI {
  start: (port?: number) => Promise<{ ok: boolean; port?: number; error?: string }>;
  stop: () => Promise<{ ok: boolean }>;
  status: () => Promise<{ running: boolean; port: number }>;
  getToken: () => Promise<string>;
  connectionInfo: () => Promise<LocalServerConnectionInfo>;
  setWrites: (writes: boolean) => Promise<{ ok: boolean; error?: string }>;
}

export function createLocalServerApi(): LocalServerAPI {
  return {
    start: (port?: number) => ipcRenderer.invoke('localServer:start', port),
    stop: () => ipcRenderer.invoke('localServer:stop'),
    status: () => ipcRenderer.invoke('localServer:status'),
    getToken: async () => {
      const result = await ipcRenderer.invoke('localServer:getToken');
      if (!result.ok) throw new Error(result.error ?? 'Failed to get token');
      return result.value as string;
    },
    connectionInfo: async () => {
      const result = await ipcRenderer.invoke('localServer:connectionInfo');
      if (!result.ok) throw new Error(result.error ?? 'Failed to load MCP connection');
      return {
        running: result.running as boolean,
        port: result.port as number,
        url: result.url as string,
        token: result.token as string,
        dbPath: result.dbPath as string,
        mcpCommand: (result.mcpCommand as string | null) ?? null,
        mcpArgs: (result.mcpArgs as string[] | null) ?? null,
      };
    },
    setWrites: writes => ipcRenderer.invoke('localServer:setWrites', writes),
  };
}
