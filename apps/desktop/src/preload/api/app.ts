import { ipcRenderer } from 'electron';
import type { BacklinkInfo, OutgoingLinkInfo, GraphData } from './types';

export interface AppVersionAPI {
  version: () => Promise<string>;
}

export interface LogAPI {
  debug: (message: string, context?: Record<string, unknown>) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
  getLogPath: () => Promise<string | null>;
}

export interface EditorAPI {
  fetchUrlTitle: (url: string) => Promise<{ title: string | null }>;
}

export interface LinksAPI {
  sync: (noteId: string, content: string) => Promise<{ ok: boolean }>;
  getBacklinks: (noteId: string) => Promise<BacklinkInfo[]>;
  getOutgoing: (noteId: string) => Promise<OutgoingLinkInfo[]>;
  getGraph: () => Promise<GraphData>;
}

export interface EmbedsAPI {
  resolve: (target: string, noteId: string) => Promise<string | null>;
  resolveBatch: (targets: string[], noteId: string) => Promise<Record<string, string | null>>;
  saveAsset: (
    noteId: string,
    mime: string,
    bytes: ArrayBuffer,
    originalName?: string
  ) => Promise<{ ok: true; filename: string; relPath: string } | { ok: false; error: string }>;
}

export interface WindowsAPI {
  openNote: (noteId: string, noteTitle: string) => Promise<{ ok: boolean }>;
  openSettings: () => Promise<{ ok: boolean }>;
  openQuickCapture: () => Promise<{ ok: boolean }>;
  closeSelf: () => Promise<{ ok: boolean }>;
}

export interface ShareAPI {
  create: (input: {
    noteId: string;
    title: string;
    content: string;
    tags?: string[];
    backlinks?: Array<{ noteId: string; title: string }>;
    wordCount?: number;
    notebookName?: string;
  }) => Promise<{ success: boolean; url?: string; slug?: string; error?: string }>;
  delete: (slug: string) => Promise<{ success: boolean; error?: string }>;
}

export function createAppApi(): AppVersionAPI {
  return {
    version: () => ipcRenderer.invoke('app:version'),
  };
}

export function createLogApi(): LogAPI {
  return {
    debug: (message, context) => {
      if (typeof message !== 'string') return;
      void ipcRenderer.invoke('log:write', 'debug', message, context);
    },
    info: (message, context) => {
      if (typeof message !== 'string') return;
      void ipcRenderer.invoke('log:write', 'info', message, context);
    },
    warn: (message, context) => {
      if (typeof message !== 'string') return;
      void ipcRenderer.invoke('log:write', 'warn', message, context);
    },
    error: (message, context) => {
      if (typeof message !== 'string') return;
      void ipcRenderer.invoke('log:write', 'error', message, context);
    },
    getLogPath: () => ipcRenderer.invoke('log:getPath'),
  };
}

export function createLinksApi(): LinksAPI {
  return {
    sync: (noteId, content) => ipcRenderer.invoke('links:sync', noteId, content),
    getBacklinks: noteId => ipcRenderer.invoke('links:backlinks', noteId),
    getOutgoing: noteId => ipcRenderer.invoke('links:outgoing', noteId),
    getGraph: () => ipcRenderer.invoke('links:graph'),
  };
}

export function createEmbedsApi(): EmbedsAPI {
  return {
    resolve: (target, noteId) => ipcRenderer.invoke('embeds:resolve', target, noteId),
    resolveBatch: (targets, noteId) => ipcRenderer.invoke('embeds:resolveBatch', targets, noteId),
    saveAsset: (noteId, mime, bytes, originalName) =>
      ipcRenderer.invoke('embeds:saveAsset', noteId, mime, bytes, originalName),
  };
}

export function createWindowsApi(): WindowsAPI {
  return {
    openNote: (noteId, noteTitle) => ipcRenderer.invoke('window:openNote', noteId, noteTitle),
    openSettings: () => ipcRenderer.invoke('window:openSettings'),
    openQuickCapture: () => ipcRenderer.invoke('window:openQuickCapture'),
    closeSelf: () => ipcRenderer.invoke('window:closeSelf'),
  };
}

export function createEditorApi(): EditorAPI {
  return {
    fetchUrlTitle: (url: string) => ipcRenderer.invoke('editor:fetchUrlTitle', url),
  };
}

export function createShareApi(): ShareAPI {
  return {
    create: input => ipcRenderer.invoke('share:create', input),
    delete: slug => ipcRenderer.invoke('share:delete', slug),
  };
}
