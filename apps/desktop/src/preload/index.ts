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

/** Backup info */
export interface BackupInfo {
  filename: string;
  path: string;
  createdAt: Date;
  sizeBytes: number;
}

/** Backup result */
export interface BackupResult {
  success: boolean;
  path?: string;
  error?: string;
}

/** Export result */
export interface ExportResult {
  success: boolean;
  path?: string;
  noteCount?: number;
  error?: string;
}

/** Import result */
export interface ImportResult {
  success: boolean;
  noteCount?: number;
  skipped?: string[];
  error?: string;
}

/** Data paths */
export interface DataPaths {
  root: string;
  database: string;
  backups: string;
  logs: string;
}

/** License state (mirrored from @readied/licensing) */
export type LicenseStatus = 'trial' | 'trial_expired' | 'licensed' | 'updates_expired';

export interface LicenseState {
  status: LicenseStatus;
  trialDaysRemaining: number | null;
  expiresAt: string | null;
  updatesUntil: string | null;
  hasUpdates: boolean;
  capabilities: string[];
}

/** License activation result */
export interface LicenseResult {
  success: boolean;
  error?: string;
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
  data: {
    /** Create a backup of the database */
    backup: () => Promise<BackupResult>;
    /** List all backups */
    listBackups: () => Promise<BackupInfo[]>;
    /** Restore from a backup */
    restoreBackup: (backupPath: string) => Promise<BackupResult>;
    /** Export notes to Markdown + JSON */
    export: () => Promise<ExportResult>;
    /** Import notes from folder (Obsidian, Markdown, or Readied export) */
    import: () => Promise<ImportResult>;
    /** Get data directory paths */
    paths: () => Promise<DataPaths>;
    /** Open data folder in system file manager */
    openFolder: () => Promise<{ success: boolean }>;
  };
  app: {
    /** Get app version */
    version: () => string;
  };
  license: {
    /** Get current license state */
    getState: () => Promise<LicenseState>;
    /** Activate license from JSON content */
    activate: (content: string) => Promise<LicenseResult>;
    /** Import license file via system dialog */
    importFile: () => Promise<LicenseResult>;
    /** Deactivate current license (for testing) */
    deactivate: () => Promise<{ success: boolean }>;
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
  data: {
    backup: () => ipcRenderer.invoke('data:backup'),
    listBackups: () => ipcRenderer.invoke('data:backups:list'),
    restoreBackup: path => ipcRenderer.invoke('data:backup:restore', path),
    export: () => ipcRenderer.invoke('data:export'),
    import: () => ipcRenderer.invoke('data:import'),
    paths: () => ipcRenderer.invoke('data:paths'),
    openFolder: () => ipcRenderer.invoke('data:openFolder'),
  },
  app: {
    version: () => '0.1.0',
  },
  license: {
    getState: () => ipcRenderer.invoke('license:getState'),
    activate: content => ipcRenderer.invoke('license:activate', content),
    importFile: () => ipcRenderer.invoke('license:importFile'),
    deactivate: () => ipcRenderer.invoke('license:deactivate'),
  },
};

contextBridge.exposeInMainWorld('readied', api);

// Type augmentation for window
declare global {
  interface Window {
    readied: ReadiedAPI;
  }
}
