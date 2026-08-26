import { ipcRenderer } from 'electron';
import type { ScannedPlugin, PluginRegistryState } from './types';

export interface PluginsAPI {
  scan: () => Promise<ScannedPlugin[]>;
  isEnabled: (pluginId: string) => Promise<boolean>;
  setEnabled: (pluginId: string, enabled: boolean) => Promise<void>;
  listState: () => Promise<PluginRegistryState[]>;
  requestReload: () => void;
  readInitScript: () => Promise<string | null>;
  readUserStyles: () => Promise<string | null>;
  readKeymap: () => Promise<string | null>;
  openUserFile: (kind: 'init' | 'styles' | 'keymap') => Promise<{
    success: boolean;
    path?: string;
    error?: string;
  }>;
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
  installFromSpec: (spec: string) => Promise<{
    success: boolean;
    pluginId?: string;
    pluginName?: string;
    error?: string;
  }>;
  uninstall: (pluginId: string) => Promise<{ success: boolean; error?: string }>;
  listRegistry: () => Promise<{
    plugins: Array<{
      slug: string;
      name: string;
      description: string;
      version: string;
      author: string;
      repositoryUrl: string | null;
      bundleUrl: string | null;
      category: string | null;
    }>;
    source: 'registry' | 'fallback';
  }>;
  setMenuItems: (
    items: Array<{ pluginId: string; label: string; commandId: string; accelerator?: string }>
  ) => void;
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
    readUserStyles: () => ipcRenderer.invoke('plugins:readUserStyles'),
    readKeymap: () => ipcRenderer.invoke('plugins:readKeymap'),
    openUserFile: kind => ipcRenderer.invoke('plugins:openUserFile', kind),
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
    installFromSpec: (spec: string) => ipcRenderer.invoke('plugins:installFromSpec', spec),
    uninstall: (pluginId: string) => ipcRenderer.invoke('plugins:uninstall', pluginId),
    listRegistry: () => ipcRenderer.invoke('plugins:listRegistry'),
    setMenuItems: items => ipcRenderer.send('menu:setPluginItems', items),
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
