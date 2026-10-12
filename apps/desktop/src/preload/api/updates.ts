import { ipcRenderer } from 'electron';

export interface UpdatesAPI {
  checkNow: () => Promise<{ available: boolean; version?: string }>;
  startDownload: () => Promise<{ ok: boolean; error?: string }>;
  installNow: () => Promise<{ ok: boolean; error?: string }>;
  onAvailable: (cb: (info: { version: string }) => void) => () => void;
  onDownloadProgress: (
    cb: (p: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void
  ) => () => void;
  onDownloadComplete: (cb: (info: { version: string }) => void) => () => void;
  onError: (cb: (err: { message: string }) => void) => () => void;
}

export function createUpdatesApi(): UpdatesAPI {
  return {
    checkNow: () => ipcRenderer.invoke('updates:checkNow'),
    startDownload: () => ipcRenderer.invoke('updates:startDownload'),
    installNow: () => ipcRenderer.invoke('updates:installNow'),
    onAvailable: (cb: (info: { version: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, info: { version: string }) => {
        cb(info);
      };
      ipcRenderer.on('updates:available', handler);
      return () => {
        ipcRenderer.removeListener('updates:available', handler);
      };
    },
    onDownloadProgress: (
      cb: (p: {
        percent: number;
        bytesPerSecond: number;
        transferred: number;
        total: number;
      }) => void
    ) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        p: { percent: number; bytesPerSecond: number; transferred: number; total: number }
      ) => {
        cb(p);
      };
      ipcRenderer.on('updates:download-progress', handler);
      return () => {
        ipcRenderer.removeListener('updates:download-progress', handler);
      };
    },
    onDownloadComplete: (cb: (info: { version: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, info: { version: string }) => {
        cb(info);
      };
      ipcRenderer.on('updates:download-complete', handler);
      return () => {
        ipcRenderer.removeListener('updates:download-complete', handler);
      };
    },
    onError: (cb: (err: { message: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, err: { message: string }) => {
        cb(err);
      };
      ipcRenderer.on('updates:error', handler);
      return () => {
        ipcRenderer.removeListener('updates:error', handler);
      };
    },
  };
}
