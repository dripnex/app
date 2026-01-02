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

/** Note status for workflow tracking */
export type NoteStatus = 'active' | 'on_hold' | 'completed' | 'dropped';

/** Note snapshot from the API */
export interface NoteSnapshot {
  id: string;
  notebookId: string;
  content: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  wordCount: number;
  archivedAt: string | null;
  isArchived: boolean;
  isPinned: boolean;
  isDeleted: boolean;
  status: NoteStatus;
}

/** Notebook snapshot from the API */
export interface NotebookSnapshot {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/** Notebook with metadata (note/child counts) */
export interface NotebookWithMetadata extends NotebookSnapshot {
  noteCount: number;
  childCount: number;
}

/** Notebook tree node */
export interface NotebookTreeNode {
  notebook: NotebookSnapshot;
  children: NotebookTreeNode[];
}

/** Notebook tree (array of root nodes) */
export type NotebookTree = NotebookTreeNode[];

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
  pinned: number;
  deleted: number;
  byStatus: Record<NoteStatus, number>;
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

/** Tag with color */
export interface TagWithColor {
  name: string;
  color: string | null;
}

/** Log level types */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** The API exposed to the renderer */
export interface ReadiedAPI {
  notes: {
    /** Create a new note */
    create: (input: { content: string; id?: string; title?: string }) => Promise<Result<NoteSnapshot>>;
    /** Get a note by ID */
    get: (id: string) => Promise<Result<NoteSnapshot>>;
    /** Update a note's content */
    update: (input: { id: string; content: string }) => Promise<Result<NoteSnapshot>>;
    /** Update a note's title (structural, independent from content) */
    updateTitle: (input: { id: string; title: string }) => Promise<Result<NoteSnapshot>>;
    /** Delete a note (hard delete) */
    delete: (id: string) => Promise<Result<void>>;
    /** Archive a note (soft delete) */
    archive: (id: string) => Promise<Result<NoteSnapshot>>;
    /** Restore an archived note */
    restore: (id: string) => Promise<Result<NoteSnapshot>>;
    /** Duplicate a note */
    duplicate: (id: string) => Promise<Result<NoteSnapshot>>;
    /** Move note to a different notebook */
    move: (noteId: string, notebookId: string) => Promise<Result<NoteSnapshot>>;
    /** Pin a note to the top */
    pin: (id: string) => Promise<Result<NoteSnapshot>>;
    /** Unpin a note */
    unpin: (id: string) => Promise<Result<NoteSnapshot>>;
    /** Move note to trash (soft delete) */
    softDelete: (id: string) => Promise<Result<NoteSnapshot>>;
    /** Restore note from trash */
    restoreDeleted: (id: string) => Promise<Result<NoteSnapshot>>;
    /** Set note workflow status */
    setStatus: (id: string, status: NoteStatus) => Promise<Result<NoteSnapshot>>;
    /** List notes */
    list: (options?: ListOptions) => Promise<NoteSnapshot[]>;
    /** Search notes */
    search: (query: string, limit?: number) => Promise<NoteSnapshot[]>;
    /** Get all tags */
    tags: () => Promise<string[]>;
    /** Get all tags with colors */
    tagsWithColors: () => Promise<TagWithColor[]>;
    /** Set color for a tag */
    setTagColor: (tagName: string, color: string | null) => Promise<{ ok: boolean }>;
    /** Delete a tag from the system */
    deleteTag: (tagName: string) => Promise<{ ok: boolean }>;
    /** Set manual tags for a note (full replacement) */
    setManualTags: (noteId: string, tags: string[]) => Promise<{ ok: boolean }>;
    /** Get manual tags only (for editor to know which are removable) */
    getManualTags: (noteId: string) => Promise<string[]>;
    /** Get note counts */
    count: () => Promise<NoteCounts>;
  };
  notebooks: {
    /** List all notebooks (flat) */
    list: () => Promise<NotebookSnapshot[]>;
    /** Get notebook tree */
    tree: () => Promise<NotebookTree>;
    /** Get a notebook by ID */
    get: (id: string) => Promise<NotebookSnapshot | null>;
    /** Get a notebook with metadata */
    getWithMetadata: (id: string) => Promise<NotebookWithMetadata | null>;
    /** Create a new notebook */
    create: (input: { name: string; parentId?: string }) => Promise<NotebookSnapshot>;
    /** Rename a notebook */
    rename: (id: string, name: string) => Promise<NotebookSnapshot>;
    /** Move a notebook to a new parent */
    move: (id: string, newParentId: string | null) => Promise<NotebookSnapshot>;
    /** Delete a notebook (notes move to Inbox) */
    delete: (id: string) => Promise<{ success: boolean }>;
    /** Reorder notebooks within a parent */
    reorder: (parentId: string | null, orderedIds: string[]) => Promise<{ success: boolean }>;
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
  log: {
    /** Log a debug message */
    debug: (message: string, context?: Record<string, unknown>) => void;
    /** Log an info message */
    info: (message: string, context?: Record<string, unknown>) => void;
    /** Log a warning message */
    warn: (message: string, context?: Record<string, unknown>) => void;
    /** Log an error message */
    error: (message: string, context?: Record<string, unknown>) => void;
    /** Get log directory path */
    getLogPath: () => Promise<string | null>;
  };
}

// Expose the API
const api: ReadiedAPI = {
  notes: {
    create: input => ipcRenderer.invoke('notes:create', input),
    get: id => ipcRenderer.invoke('notes:get', id),
    update: input => ipcRenderer.invoke('notes:update', input),
    updateTitle: input => ipcRenderer.invoke('notes:updateTitle', input),
    delete: id => ipcRenderer.invoke('notes:delete', id),
    archive: id => ipcRenderer.invoke('notes:archive', id),
    restore: id => ipcRenderer.invoke('notes:restore', id),
    duplicate: id => ipcRenderer.invoke('notes:duplicate', id),
    move: (noteId, notebookId) => ipcRenderer.invoke('notes:move', noteId, notebookId),
    pin: id => ipcRenderer.invoke('notes:pin', id),
    unpin: id => ipcRenderer.invoke('notes:unpin', id),
    softDelete: id => ipcRenderer.invoke('notes:softDelete', id),
    restoreDeleted: id => ipcRenderer.invoke('notes:restoreDeleted', id),
    setStatus: (id, status) => ipcRenderer.invoke('notes:setStatus', id, status),
    list: options => ipcRenderer.invoke('notes:list', options),
    search: (query, limit) => ipcRenderer.invoke('notes:search', query, limit),
    tags: () => ipcRenderer.invoke('notes:tags'),
    tagsWithColors: () => ipcRenderer.invoke('tags:listWithColors'),
    setTagColor: (tagName, color) => ipcRenderer.invoke('tags:setColor', tagName, color),
    deleteTag: tagName => ipcRenderer.invoke('tags:delete', tagName),
    setManualTags: (noteId, tags) => ipcRenderer.invoke('notes:setManualTags', noteId, tags),
    getManualTags: noteId => ipcRenderer.invoke('notes:getManualTags', noteId),
    count: () => ipcRenderer.invoke('notes:count'),
  },
  notebooks: {
    list: () => ipcRenderer.invoke('notebooks:list'),
    tree: () => ipcRenderer.invoke('notebooks:tree'),
    get: id => ipcRenderer.invoke('notebooks:get', id),
    getWithMetadata: id => ipcRenderer.invoke('notebooks:getWithMetadata', id),
    create: input => ipcRenderer.invoke('notebooks:create', input),
    rename: (id, name) => ipcRenderer.invoke('notebooks:rename', id, name),
    move: (id, newParentId) => ipcRenderer.invoke('notebooks:move', id, newParentId),
    delete: id => ipcRenderer.invoke('notebooks:delete', id),
    reorder: (parentId, orderedIds) =>
      ipcRenderer.invoke('notebooks:reorder', parentId, orderedIds),
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
  log: {
    debug: (message, context) => {
      ipcRenderer.invoke('log:write', 'debug', message, context);
    },
    info: (message, context) => {
      ipcRenderer.invoke('log:write', 'info', message, context);
    },
    warn: (message, context) => {
      ipcRenderer.invoke('log:write', 'warn', message, context);
    },
    error: (message, context) => {
      ipcRenderer.invoke('log:write', 'error', message, context);
    },
    getLogPath: () => ipcRenderer.invoke('log:getPath'),
  },
};

contextBridge.exposeInMainWorld('readied', api);

// Type augmentation for window
declare global {
  interface Window {
    readied: ReadiedAPI;
  }
}
