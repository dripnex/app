/**
 * Electron Preload Script
 *
 * Exposes a typed API to the renderer process via contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron';

/** Result type from operations */
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { type: string; error?: unknown } };

/** Note snapshot from the API */
export interface NoteSnapshot {
  id: string;
  content: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  wordCount: number;
  archivedAt: string | null;
  isArchived: boolean;
}

/** List options */
export interface ListOptions {
  limit?: number;
  offset?: number;
  tag?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  archived?: 'active' | 'archived' | 'all';
}

/** Note counts */
export interface NoteCounts {
  active: number;
  archived: number;
  total: number;
}

/** The API exposed to the renderer */
export interface ReadiedAPI {
  notes: {
    /** Create a new note */
    create: (input: { content: string; id?: string }) => Promise<Result<NoteSnapshot>>;
    /** Get a note by ID */
    get: (id: string) => Promise<Result<NoteSnapshot>>;
    /** Update a note */
    update: (input: { id: string; content: string }) => Promise<Result<NoteSnapshot>>;
    /** Delete a note (hard delete) */
    delete: (id: string) => Promise<Result<void>>;
    /** Archive a note (soft delete) */
    archive: (id: string) => Promise<Result<NoteSnapshot>>;
    /** Restore an archived note */
    restore: (id: string) => Promise<Result<NoteSnapshot>>;
    /** Duplicate a note */
    duplicate: (id: string) => Promise<Result<NoteSnapshot>>;
    /** List notes */
    list: (options?: ListOptions) => Promise<NoteSnapshot[]>;
    /** Search notes */
    search: (query: string, limit?: number) => Promise<NoteSnapshot[]>;
    /** Get all tags */
    tags: () => Promise<string[]>;
    /** Get note counts */
    count: () => Promise<NoteCounts>;
  };
  app: {
    /** Get app version */
    version: () => string;
  };
}

// Expose the API
const api: ReadiedAPI = {
  notes: {
    create: input => ipcRenderer.invoke('notes:create', input),
    get: id => ipcRenderer.invoke('notes:get', id),
    update: input => ipcRenderer.invoke('notes:update', input),
    delete: id => ipcRenderer.invoke('notes:delete', id),
    archive: id => ipcRenderer.invoke('notes:archive', id),
    restore: id => ipcRenderer.invoke('notes:restore', id),
    duplicate: id => ipcRenderer.invoke('notes:duplicate', id),
    list: options => ipcRenderer.invoke('notes:list', options),
    search: (query, limit) => ipcRenderer.invoke('notes:search', query, limit),
    tags: () => ipcRenderer.invoke('notes:tags'),
    count: () => ipcRenderer.invoke('notes:count'),
  },
  app: {
    version: () => '0.1.0',
  },
};

contextBridge.exposeInMainWorld('readied', api);

// Type augmentation for window
declare global {
  interface Window {
    readied: ReadiedAPI;
  }
}
