import { ipcRenderer } from 'electron';
import type { ScannedPlugin, PluginRegistryState } from './types';

export interface PluginsAPI {
  scan: () => Promise<ScannedPlugin[]>;
  isEnabled: (pluginId: string) => Promise<boolean>;
  setEnabled: (pluginId: string, enabled: boolean) => Promise<void>;
  listState: () => Promise<PluginRegistryState[]>;
  requestReload: () => void;
  readInitScript: () => Promise<string | null>;
  install: () => Promise<{
    success: boolean;
    pluginId?: string;
    pluginName?: string;
    error?: string;
  }>;
  installFromUrl: (
    url: string,
    slug: string
  ) => Promise<{
    success: boolean;
    pluginId?: string;
    pluginName?: string;
    error?: string;
  }>;
  uninstall: (pluginId: string) => Promise<{ success: boolean; error?: string }>;
}

export interface PluginConfigAPI {
  get: (pluginId: string, key: string) => Promise<unknown>;
  set: (pluginId: string, key: string, value: unknown) => Promise<void>;
  getAll: (pluginId: string) => Promise<Record<string, unknown>>;
  clear: (pluginId: string) => Promise<void>;
}

export function createPluginsApi(): PluginsAPI {
  return {
    scan: () => ipcRenderer.invoke('plugins:scan'),
    isEnabled: pluginId => ipcRenderer.invoke('plugins:isEnabled', pluginId),
    setEnabled: (pluginId, enabled) => ipcRenderer.invoke('plugins:setEnabled', pluginId, enabled),
    listState: () => ipcRenderer.invoke('plugins:listState'),
    requestReload: () => ipcRenderer.send('plugins:requestReload'),
    readInitScript: () => ipcRenderer.invoke('plugins:readInitScript'),
    install: () => ipcRenderer.invoke('plugins:install'),
    installFromUrl: (url: string, slug: string) => {
      // Validate URL is HTTPS before sending to main process
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') {
          return Promise.resolve({ success: false, error: 'Only HTTPS URLs are allowed' });
        }
      } catch {
        return Promise.resolve({ success: false, error: 'Invalid URL' });
      }
      return ipcRenderer.invoke('plugins:installFromUrl', url, slug);
    },
    uninstall: (pluginId: string) => ipcRenderer.invoke('plugins:uninstall', pluginId),
  };
}

export function createPluginConfigApi(): PluginConfigAPI {
  return {
    get: (pluginId, key) => ipcRenderer.invoke('pluginConfig:get', pluginId, key),
    set: (pluginId, key, value) => ipcRenderer.invoke('pluginConfig:set', pluginId, key, value),
    getAll: pluginId => ipcRenderer.invoke('pluginConfig:getAll', pluginId),
    clear: pluginId => ipcRenderer.invoke('pluginConfig:clear', pluginId),
  };
}
