import { ipcRenderer } from 'electron';

export interface SettingsAPI {
  broadcast: (settings: Record<string, unknown>) => void;
  onSync: (callback: (settings: Record<string, unknown>) => void) => () => void;
}

export interface IpcAPI {
  on: (channel: string, listener: (...args: unknown[]) => void) => () => void;
}

export interface ThemeAPI {
  setSource: (source: 'dark' | 'light' | 'system') => void;
  onSystemChanged: (callback: (isDark: boolean) => void) => () => void;
}

export function createSettingsApi(): SettingsAPI {
  return {
    broadcast: (settings: Record<string, unknown>) => {
      if (settings && typeof settings === 'object') {
        ipcRenderer.send('settings:changed', settings);
      }
    },
    onSync: (callback: (settings: Record<string, unknown>) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, settings: Record<string, unknown>) => {
        callback(settings);
      };
      ipcRenderer.on('settings:sync', handler);
      return () => {
        ipcRenderer.removeListener('settings:sync', handler);
      };
    },
  };
}

export function createIpcApi(): IpcAPI {
  return {
    on: (channel: string, listener: (...args: unknown[]) => void) => {
      ipcRenderer.on(channel, (_event, ...args) => listener(...args));
      return () => {
        ipcRenderer.removeAllListeners(channel);
      };
    },
  };
}

export function createThemeApi(): ThemeAPI {
  return {
    setSource: (source: 'dark' | 'light' | 'system') => {
      ipcRenderer.send('theme:set-source', source);
    },
    onSystemChanged: (callback: (isDark: boolean) => void) => {
      const handler = (_event: unknown, isDark: boolean) => callback(isDark);
      ipcRenderer.on('theme:system-changed', handler);
      return () => {
        ipcRenderer.removeListener('theme:system-changed', handler);
      };
    },
  };
}
