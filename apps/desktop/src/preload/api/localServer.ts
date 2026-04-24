/**
 * Local Server Preload API
 *
 * Exposes local HTTP API server controls to the renderer.
 */

import { ipcRenderer } from 'electron';

export interface LocalServerAPI {
  start: (port?: number) => Promise<{ ok: boolean; port?: number; error?: string }>;
  stop: () => Promise<{ ok: boolean }>;
  status: () => Promise<{ running: boolean; port: number }>;
  getToken: () => Promise<string>;
}

export function createLocalServerApi(): LocalServerAPI {
  return {
    start: (port?: number) => ipcRenderer.invoke('localServer:start', port),
    stop: () => ipcRenderer.invoke('localServer:stop'),
    status: () => ipcRenderer.invoke('localServer:status'),
    getToken: () => ipcRenderer.invoke('localServer:getToken'),
  };
}
