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

/** License state (mirrored from @readied/licensing AppLicenseState) */
export type LicenseStatus =
  | 'free'
  | 'trial'
  | 'pro_active'
  | 'pro_grace'
  | 'pro_expired'
  // Legacy statuses (kept for backwards compat)
  | 'trial_expired'
  | 'licensed'
  | 'updates_expired';

export interface TrialInfo {
  startDate: string;
  daysRemaining: number;
  isExpired: boolean;
}

export interface SubscriptionInfo {
  subscriptionId: string;
  customerId: string;
  email: string;
  plan: 'monthly' | 'annual';
  status: 'active' | 'past_due' | 'canceled' | 'paused';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface LicenseState {
  status: LicenseStatus;
  trial?: TrialInfo;
  subscription?: SubscriptionInfo;
  // Legacy fields (kept for backwards compat in settings UI)
  trialDaysRemaining?: number | null;
  expiresAt?: string | null;
  updatesUntil?: string | null;
  hasUpdates?: boolean;
  capabilities?: string[];
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

/** Backlink information (notes that link TO a note) */
export interface BacklinkInfo {
  noteId: string;
  noteTitle: string;
  targetRef: string;
}

/** Outgoing link information (notes that a note links TO) */
export interface OutgoingLinkInfo {
  targetRef: string;
  targetNoteId: string | null;
  targetTitle: string | null;
}

/** Graph data for visualization */
export interface GraphData {
  nodes: Array<{ id: string; title: string; notebookId: string }>;
  edges: Array<{ source: string; target: string }>;
}

/** Log level types */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** User type for authentication */
export interface User {
  id: string;
  email: string;
}

/** Sync change */
export interface SyncChange {
  id: string;
  noteId: string;
  version: number;
  operation: 'create' | 'update' | 'delete';
  encryptedData: string | null;
  deviceId: string;
  createdAt: string;
}

/** Pull response */
export interface PullResponse {
  changes: SyncChange[];
  cursor: number;
  hasMore: boolean;
}

/** Push result */
export interface PushResult {
  noteId: string;
  version: number;
  status: 'applied' | 'conflict';
  serverVersion?: number;
}

/** Push response */
export interface PushResponse {
  results: PushResult[];
  cursor: number;
}

/** Sync status */
export interface SyncStatus {
  enabled: boolean;
  plan: string;
  cursor: number;
  totalChanges: number;
}

/** Subscription status */
export interface SubscriptionStatus {
  plan: string;
  status: string;
  syncEnabled: boolean;
  currentPeriodEnd?: string;
  trialEndsAt?: string;
  canceledAt?: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  cancelAtPeriodEnd?: boolean;
}

/** Scanned plugin from filesystem */
export interface PluginConfigSchemaField {
  type: 'string' | 'number' | 'boolean' | 'enum' | 'range';
  default: unknown;
  description?: string;
  /** For 'enum' type: available options */
  options?: Array<{ value: string; label: string }>;
  /** For 'range' type */
  min?: number;
  max?: number;
  step?: number;
}

export interface ScannedPlugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  configSchema?: Record<string, PluginConfigSchemaField>;
  code: string;
  path: string;
}

/** Plugin registry state row */
export interface PluginRegistryState {
  pluginId: string;
  enabled: boolean;
}

/** The API exposed to the renderer */
export interface ReadiedAPI {
  notes: {
    /** Create a new note */
    create: (input: {
      content: string;
      id?: string;
      title?: string;
      notebookId?: string;
    }) => Promise<Result<NoteSnapshot>>;
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
    /** Rename a tag across all notes */
    renameTag: (oldName: string, newName: string) => Promise<{ ok: boolean; error?: string }>;
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
    /** Enable git for a notebook */
    enableGit: (notebookId: string) => Promise<{ success: boolean; error?: string }>;
    /** Disable git for a notebook */
    disableGit: (notebookId: string) => Promise<{ success: boolean; error?: string }>;
    /** Check if git is enabled for a notebook */
    isGitEnabled: (
      notebookId: string
    ) => Promise<{ success: boolean; enabled?: boolean; error?: string }>;
    /** Get git settings for a notebook */
    getGitSettings: (notebookId: string) => Promise<{
      success: boolean;
      settings?: {
        enabled: boolean;
        autoCommit: boolean;
        initializedAt: string | null;
      };
      error?: string;
    }>;
    /** Toggle auto-commit for a notebook */
    setGitAutoCommit: (
      notebookId: string,
      enabled: boolean
    ) => Promise<{ success: boolean; error?: string }>;
    /** Get all git-enabled notebooks */
    getGitEnabled: () => Promise<{
      success: boolean;
      notebooks?: NotebookSnapshot[];
      error?: string;
    }>;
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
    version: () => Promise<string>;
  };
  license: {
    /** Get current license state */
    getState: () => Promise<LicenseState>;
    /** Force-refresh subscription from API (ignores cache) */
    refreshSubscription: () => Promise<LicenseState>;
    /** Start trial manually */
    startTrial: () => Promise<{ success: boolean; error?: string }>;
    /** Open subscription checkout page */
    openSubscribe: (options?: {
      plan?: 'monthly' | 'annual';
    }) => Promise<{ success: boolean; error?: string }>;
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
  links: {
    /** Sync links for a note (extracts wikilinks and updates link table) */
    sync: (noteId: string, content: string) => Promise<{ ok: boolean }>;
    /** Get backlinks (notes that link TO this note) */
    getBacklinks: (noteId: string) => Promise<BacklinkInfo[]>;
    /** Get outgoing links (notes this note links TO) */
    getOutgoing: (noteId: string) => Promise<OutgoingLinkInfo[]>;
    /** Get graph data (all notes and links for visualization) */
    getGraph: () => Promise<GraphData>;
  };
  embeds: {
    /** Resolve embed target to file:// URL (returns null if not found) */
    resolve: (target: string, noteId: string) => Promise<string | null>;
    /** Batch resolve multiple embed targets (more efficient) */
    resolveBatch: (targets: string[], noteId: string) => Promise<Record<string, string | null>>;
    /** Save asset (image/file) for a note via drag & drop or paste */
    saveAsset: (
      noteId: string,
      mime: string,
      bytes: ArrayBuffer,
      originalName?: string
    ) => Promise<{ ok: true; filename: string; relPath: string } | { ok: false; error: string }>;
  };
  windows: {
    /** Open a note in a new window */
    openNote: (noteId: string, noteTitle: string) => Promise<{ ok: boolean }>;
    /** Open the settings window */
    openSettings: () => Promise<{ ok: boolean }>;
  };
  auth: {
    /** Request a magic link email */
    requestMagicLink: (email: string) => Promise<{ success: boolean; error?: string }>;
    /** Verify magic link token and authenticate */
    verifyToken: (token: string) => Promise<{ success: boolean; user?: User; error?: string }>;
    /** Get current session */
    getSession: () => Promise<{ user: User } | null>;
    /** Logout and clear tokens */
    logout: () => Promise<{ success: boolean; error?: string }>;
    /** Refresh access token */
    refreshToken: () => Promise<{ success: boolean }>;
  };
  sync: {
    /** Pull changes from server */
    pull: () => Promise<{
      success: boolean;
      changes?: SyncChange[];
      cursor?: number;
      hasMore?: boolean;
      conflicts?: Array<{
        noteId: string;
        localContent: string;
        remoteContent: string;
        localVersion: number;
        remoteVersion: number;
        timestamp: string;
      }>;
      error?: string;
    }>;
    /** Push changes to server */
    push: (
      changes: Array<{
        noteId: string;
        operation: 'create' | 'update' | 'delete';
        content?: string;
        localVersion?: number;
      }>
    ) => Promise<{
      success: boolean;
      results?: PushResult[];
      error?: string;
    }>;
    /** Perform full sync cycle (pull + push) */
    syncNow: () => Promise<{
      success: boolean;
      changesApplied: number;
      changesPushed: number;
      conflicts: Array<{
        noteId: string;
        localContent: string;
        remoteContent: string;
        localVersion: number;
        remoteVersion: number;
        timestamp: string;
      }>;
      error?: string;
    }>;
    /** Get sync status */
    status: () => Promise<{
      success: boolean;
      cursor?: number;
      lastSyncAt?: number | null;
      isSyncing?: boolean;
      lastError?: string | null;
      consecutiveFailures?: number;
      error?: string;
    }>;
    /** Listen for sync status events pushed from main process */
    onStatusChange: (callback: (event: unknown) => void) => () => void;
    /** Resolve a sync conflict */
    resolveConflict: (
      noteId: string,
      resolution: 'local' | 'remote'
    ) => Promise<{ success: boolean; error?: string }>;
    /** Start auto-sync timer */
    startAutoSync: (intervalMs?: number) => Promise<{ success: boolean; error?: string }>;
    /** Stop auto-sync timer */
    stopAutoSync: () => Promise<{ success: boolean; error?: string }>;
    /** Trigger manual sync */
    triggerSync: () => Promise<void>;
    /** Pull tag changes from server */
    pullTags: () => Promise<{ success: boolean; applied: number; error?: string }>;
    /** Push tag changes to server */
    pushTags: () => Promise<{ success: boolean; pushed: number; error?: string }>;
    /** Get number of pending local changes */
    pendingCount: () => Promise<{ success: boolean; count: number; error?: string }>;
    /** Get sync history */
    history: (limit?: number) => Promise<{
      success: boolean;
      history: Array<{
        id: string;
        startedAt: string;
        completedAt: string | null;
        status: 'running' | 'success' | 'partial' | 'error';
        notesPulled: number;
        notesPushed: number;
        notebooksPulled: number;
        notebooksPushed: number;
        tagsPulled: number;
        tagsPushed: number;
        conflicts: number;
        bytesSent: number;
        bytesReceived: number;
        errorMessage: string | null;
      }>;
      error?: string;
    }>;
  };
  subscription: {
    /** Get subscription status */
    getStatus: () => Promise<{
      success: boolean;
      status?: SubscriptionStatus;
      error?: string;
    }>;
    /** Open Stripe billing portal */
    openPortal: (returnUrl: string) => Promise<{ success: boolean; error?: string }>;
    /** Open checkout page */
    openCheckout: () => Promise<{ success: boolean; error?: string }>;
  };
  devices: {
    /** List all registered devices */
    list: () => Promise<
      Array<{
        id: string;
        deviceId: string;
        name: string | null;
        platform: string | null;
        isCurrent: boolean;
        lastSeenAt: string;
        createdAt: string;
      }>
    >;
    /** Rename a device */
    rename: (deviceId: string, name: string) => Promise<{ success: boolean; error?: string }>;
    /** Revoke (delete) a device */
    revoke: (deviceId: string) => Promise<{ success: boolean; error?: string }>;
    /** Revoke all devices except current */
    revokeOthers: () => Promise<{ success: boolean; revokedCount?: number; error?: string }>;
    /** Get current device info */
    getCurrent: () => Promise<{
      id: string;
      deviceId: string;
      name: string | null;
      platform: string | null;
      isCurrent: boolean;
      lastSeenAt: string;
      createdAt: string;
    } | null>;
  };
  settings: {
    /** Broadcast settings change to all other windows */
    broadcast: (settings: Record<string, unknown>) => void;
    /** Listen for settings sync from other windows */
    onSync: (callback: (settings: Record<string, unknown>) => void) => () => void;
  };
  ipc: {
    /** Listen to IPC events from main process */
    on: (channel: string, listener: (...args: unknown[]) => void) => () => void;
  };
  share: {
    /** Share a note on the web (creates or updates, auto-copies URL to clipboard) */
    create: (input: {
      noteId: string;
      title: string;
      content: string;
      tags?: string[];
      backlinks?: Array<{ noteId: string; title: string }>;
      wordCount?: number;
      notebookName?: string;
    }) => Promise<{ success: boolean; url?: string; slug?: string; error?: string }>;
    /** Remove a shared note */
    delete: (slug: string) => Promise<{ success: boolean; error?: string }>;
  };
  encryption: {
    /** Export encryption key for backup */
    exportKey: () => Promise<{ success: boolean; key?: string; error?: string }>;
    /** Import encryption key from backup */
    importKey: (keyHex: string) => Promise<{ success: boolean; error?: string }>;
    /** Check if encryption is ready (CEK cached locally) */
    isReady: () => Promise<{ ready: boolean }>;
    /** Get key status — server keys, local cache, legacy key */
    getKeyStatus: () => Promise<{
      success: boolean;
      hasServerKeys?: boolean;
      hasLocalKey?: boolean;
      hasLegacyKey?: boolean;
      error?: string;
    }>;
    /** First device: set up encryption keys with passphrase */
    setupKeys: (passphrase: string) => Promise<{
      success: boolean;
      recoveryKey?: string | null;
      error?: string;
    }>;
    /** New device: unlock with passphrase */
    unlockWithPassphrase: (passphrase: string) => Promise<{
      success: boolean;
      wrongPassphrase?: boolean;
      error?: string;
    }>;
    /** Unlock with recovery key */
    unlockWithRecoveryKey: (recoveryKey: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
    /** Migrate legacy per-device key to key hierarchy */
    migrateLegacyKey: (passphrase: string) => Promise<{
      success: boolean;
      recoveryKey?: string | null;
      error?: string;
    }>;
    /** Change passphrase (re-wrap CEK) */
    changePassphrase: (newPassphrase: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
  };
  git: {
    /** Initialize git repository for a notebook */
    init: (notebookId: string) => Promise<{ success: boolean; repoPath?: string; error?: string }>;
    /** Check if notebook has a git repository */
    isRepo: (notebookId: string) => Promise<{ success: boolean; isRepo?: boolean; error?: string }>;
    /** Commit changes to git repository */
    commit: (
      notebookId: string,
      message: string,
      files?: string[]
    ) => Promise<{ success: boolean; sha?: string; error?: string }>;
    /** Get commit history */
    log: (
      notebookId: string,
      limit?: number
    ) => Promise<{
      success: boolean;
      commits?: Array<{
        oid: string;
        message: string;
        author: { name: string; email: string; timestamp: number };
        committer: { name: string; email: string; timestamp: number };
      }>;
      error?: string;
    }>;
    /** Get repository status */
    status: (notebookId: string) => Promise<{
      success: boolean;
      status?: {
        modified: string[];
        added: string[];
        deleted: string[];
        untracked: string[];
      };
      error?: string;
    }>;
    /** Checkout (revert to) a specific commit */
    checkout: (
      notebookId: string,
      commitSha: string
    ) => Promise<{ success: boolean; error?: string }>;
    /** Write note file to git repository */
    writeNote: (
      notebookId: string,
      noteId: string,
      content: string
    ) => Promise<{ success: boolean; error?: string }>;
    /** Read note file from git repository */
    readNote: (
      notebookId: string,
      noteId: string
    ) => Promise<{ success: boolean; content?: string | null; error?: string }>;
    /** Delete note file from git repository */
    deleteNote: (
      notebookId: string,
      noteId: string
    ) => Promise<{ success: boolean; error?: string }>;
  };
  updates: {
    /** Check for updates manually */
    checkNow: () => Promise<{ available: boolean; version?: string }>;
    /** Start downloading the available update */
    startDownload: () => Promise<{ ok: boolean }>;
    /** Quit and install the downloaded update */
    installNow: () => Promise<void>;
    /** Subscribe to update-available events from background check */
    onAvailable: (cb: (info: { version: string }) => void) => () => void;
    /** Subscribe to download progress events */
    onDownloadProgress: (
      cb: (p: {
        percent: number;
        bytesPerSecond: number;
        transferred: number;
        total: number;
      }) => void
    ) => () => void;
    /** Subscribe to download complete events */
    onDownloadComplete: (cb: (info: { version: string }) => void) => () => void;
    /** Subscribe to update error events */
    onError: (cb: (err: { message: string }) => void) => () => void;
  };
  ai: {
    /** Start a streaming AI chat — returns { requestId } */
    chat: (request: {
      query: string;
      currentNote?: { id: string; title: string; content: string } | null;
      relevantNotes: Array<{ id: string; title: string; content: string }>;
      history: Array<{ role: 'user' | 'assistant'; content: string }>;
      mode: 'chat' | 'ask-notes';
      provider: string;
      model: string;
      providerConfig: { apiKey?: string; baseUrl?: string };
      maxResponseTokens?: number;
      tools?: boolean;
    }) => Promise<{ requestId: string }>;
    /** Listen for streaming AI events */
    onEvent: (cb: (requestId: string, event: unknown) => void) => () => void;
    /** Cancel an active AI request */
    cancel: (requestId: string) => Promise<void>;
    /** Validate a provider configuration */
    validate: (config: {
      provider: string;
      apiKey?: string;
      baseUrl?: string;
    }) => Promise<{ ok: boolean; error?: string }>;
    /** Export an AI command preset to a user-chosen file */
    exportPreset: (
      presetJson: string
    ) => Promise<{ ok: true; filePath: string } | { ok: false; error: string }>;
    /** Import an AI command preset from a user-chosen file */
    importPreset: () => Promise<{ ok: true; content: string } | { ok: false; error: string }>;
    /** Confirm or reject a tool execution */
    confirmTool: (requestId: string, callId: string, approved: boolean) => Promise<void>;
    /** Listen for renderer-executed tool requests from main */
    onToolExecuteRequest: (
      cb: (requestId: string, callId: string, toolName: string, args: unknown) => void
    ) => () => void;
    /** Send renderer tool execution result back to main */
    sendToolResult: (
      requestId: string,
      callId: string,
      result: { ok: boolean; content: string; error?: string }
    ) => Promise<void>;
    /** Save an API key for a provider (encrypted with OS keychain) */
    saveKey: (provider: string, apiKey: string) => Promise<void>;
    /** Get an API key for a provider */
    getKey: (provider: string) => Promise<string | null>;
    /** Remove an API key for a provider */
    removeKey: (provider: string) => Promise<void>;
    /** Check if a provider has a stored key */
    hasKey: (provider: string) => Promise<boolean>;
    /** List providers that have stored API keys */
    listConnectedProviders: () => Promise<string[]>;
  };
  pluginConfig: {
    /** Get a single config value for a plugin */
    get: (pluginId: string, key: string) => Promise<unknown>;
    /** Set a config value for a plugin */
    set: (pluginId: string, key: string, value: unknown) => Promise<void>;
    /** Get all config values for a plugin */
    getAll: (pluginId: string) => Promise<Record<string, unknown>>;
    /** Clear all config for a plugin */
    clear: (pluginId: string) => Promise<void>;
  };
  theme: {
    /** Set the nativeTheme source in the main process */
    setSource: (source: 'dark' | 'light' | 'system') => void;
    /** Listen for system theme changes from the main process */
    onSystemChanged: (callback: (isDark: boolean) => void) => () => void;
  };
  plugins: {
    /** Scan filesystem for installed plugins */
    scan: () => Promise<ScannedPlugin[]>;
    /** Check if a plugin is enabled */
    isEnabled: (pluginId: string) => Promise<boolean>;
    /** Enable or disable a plugin */
    setEnabled: (pluginId: string, enabled: boolean) => Promise<void>;
    /** List all plugin registry state */
    listState: () => Promise<PluginRegistryState[]>;
    /** Request all windows to reload plugins */
    requestReload: () => void;
    /** Read user init.js script (returns null if not found) */
    readInitScript: () => Promise<string | null>;
    /** Install plugin from a local archive (opens file dialog) */
    install: () => Promise<{
      success: boolean;
      pluginId?: string;
      pluginName?: string;
      error?: string;
    }>;
    /** Uninstall a community plugin by ID */
    uninstall: (pluginId: string) => Promise<{ success: boolean; error?: string }>;
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
    renameTag: (oldName, newName) => ipcRenderer.invoke('tags:rename', oldName, newName),
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
    enableGit: notebookId => ipcRenderer.invoke('notebooks:enableGit', notebookId),
    disableGit: notebookId => ipcRenderer.invoke('notebooks:disableGit', notebookId),
    isGitEnabled: notebookId => ipcRenderer.invoke('notebooks:isGitEnabled', notebookId),
    getGitSettings: notebookId => ipcRenderer.invoke('notebooks:getGitSettings', notebookId),
    setGitAutoCommit: (notebookId, enabled) =>
      ipcRenderer.invoke('notebooks:setGitAutoCommit', notebookId, enabled),
    getGitEnabled: () => ipcRenderer.invoke('notebooks:getGitEnabled'),
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
    version: () => ipcRenderer.invoke('app:version'),
  },
  license: {
    getState: () => ipcRenderer.invoke('license:getState'),
    refreshSubscription: () => ipcRenderer.invoke('license:refreshSubscription'),
    startTrial: () => ipcRenderer.invoke('license:startTrial'),
    openSubscribe: options => ipcRenderer.invoke('license:openSubscribe', options),
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
  links: {
    sync: (noteId, content) => ipcRenderer.invoke('links:sync', noteId, content),
    getBacklinks: noteId => ipcRenderer.invoke('links:backlinks', noteId),
    getOutgoing: noteId => ipcRenderer.invoke('links:outgoing', noteId),
    getGraph: () => ipcRenderer.invoke('links:graph'),
  },
  embeds: {
    resolve: (target, noteId) => ipcRenderer.invoke('embeds:resolve', target, noteId),
    resolveBatch: (targets, noteId) => ipcRenderer.invoke('embeds:resolveBatch', targets, noteId),
    saveAsset: (noteId, mime, bytes, originalName) =>
      ipcRenderer.invoke('embeds:saveAsset', noteId, mime, bytes, originalName),
  },
  windows: {
    openNote: (noteId, noteTitle) => ipcRenderer.invoke('window:openNote', noteId, noteTitle),
    openSettings: () => ipcRenderer.invoke('window:openSettings'),
  },
  auth: {
    requestMagicLink: email => ipcRenderer.invoke('auth:requestMagicLink', email),
    verifyToken: token => ipcRenderer.invoke('auth:verify', token),
    getSession: () => ipcRenderer.invoke('auth:getSession'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    refreshToken: () => ipcRenderer.invoke('auth:refreshToken'),
  },
  sync: {
    pull: () => ipcRenderer.invoke('sync:pull'),
    push: changes => ipcRenderer.invoke('sync:push', changes),
    syncNow: () => ipcRenderer.invoke('sync:syncNow'),
    status: () => ipcRenderer.invoke('sync:status'),
    resolveConflict: (noteId, resolution) =>
      ipcRenderer.invoke('sync:resolveConflict', noteId, resolution),
    startAutoSync: intervalMs => ipcRenderer.invoke('sync:startAutoSync', intervalMs),
    stopAutoSync: () => ipcRenderer.invoke('sync:stopAutoSync'),
    triggerSync: () => ipcRenderer.invoke('sync:trigger'),
    pullTags: () => ipcRenderer.invoke('sync:pullTags'),
    pushTags: () => ipcRenderer.invoke('sync:pushTags'),
    pendingCount: () => ipcRenderer.invoke('sync:pendingCount'),
    history: (limit?: number) => ipcRenderer.invoke('sync:history', limit),
    onStatusChange: (callback: (event: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: unknown) => {
        callback(data);
      };
      ipcRenderer.on('sync:status-changed', handler);
      return () => {
        ipcRenderer.removeListener('sync:status-changed', handler);
      };
    },
  },
  subscription: {
    getStatus: () => ipcRenderer.invoke('subscription:getStatus'),
    openPortal: returnUrl => ipcRenderer.invoke('subscription:openPortal', returnUrl),
    openCheckout: () => ipcRenderer.invoke('subscription:openCheckout'),
  },
  devices: {
    list: () => ipcRenderer.invoke('devices:list'),
    rename: (deviceId: string, name: string) =>
      ipcRenderer.invoke('devices:rename', deviceId, name),
    revoke: (deviceId: string) => ipcRenderer.invoke('devices:revoke', deviceId),
    revokeOthers: () => ipcRenderer.invoke('devices:revokeOthers'),
    getCurrent: () => ipcRenderer.invoke('devices:getCurrent'),
  },
  settings: {
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
  },
  ipc: {
    on: (channel: string, listener: (...args: unknown[]) => void) => {
      ipcRenderer.on(channel, (_event, ...args) => listener(...args));
      return () => {
        ipcRenderer.removeAllListeners(channel);
      };
    },
  },
  share: {
    create: input => ipcRenderer.invoke('share:create', input),
    delete: slug => ipcRenderer.invoke('share:delete', slug),
  },
  encryption: {
    exportKey: () => ipcRenderer.invoke('encryption:exportKey'),
    importKey: (keyHex: string) => ipcRenderer.invoke('encryption:importKey', keyHex),
    isReady: () => ipcRenderer.invoke('encryption:isReady'),
    getKeyStatus: () => ipcRenderer.invoke('encryption:getKeyStatus'),
    setupKeys: (passphrase: string) => ipcRenderer.invoke('encryption:setupKeys', passphrase),
    unlockWithPassphrase: (passphrase: string) =>
      ipcRenderer.invoke('encryption:unlockWithPassphrase', passphrase),
    unlockWithRecoveryKey: (recoveryKey: string) =>
      ipcRenderer.invoke('encryption:unlockWithRecoveryKey', recoveryKey),
    migrateLegacyKey: (passphrase: string) =>
      ipcRenderer.invoke('encryption:migrateLegacyKey', passphrase),
    changePassphrase: (newPassphrase: string) =>
      ipcRenderer.invoke('encryption:changePassphrase', newPassphrase),
  },
  git: {
    init: (notebookId: string) => ipcRenderer.invoke('git:init', notebookId),
    isRepo: (notebookId: string) => ipcRenderer.invoke('git:isRepo', notebookId),
    commit: (notebookId: string, message: string, files?: string[]) =>
      ipcRenderer.invoke('git:commit', notebookId, message, files),
    log: (notebookId: string, limit?: number) => ipcRenderer.invoke('git:log', notebookId, limit),
    status: (notebookId: string) => ipcRenderer.invoke('git:status', notebookId),
    checkout: (notebookId: string, commitSha: string) =>
      ipcRenderer.invoke('git:checkout', notebookId, commitSha),
    writeNote: (notebookId: string, noteId: string, content: string) =>
      ipcRenderer.invoke('git:writeNote', notebookId, noteId, content),
    readNote: (notebookId: string, noteId: string) =>
      ipcRenderer.invoke('git:readNote', notebookId, noteId),
    deleteNote: (notebookId: string, noteId: string) =>
      ipcRenderer.invoke('git:deleteNote', notebookId, noteId),
  },
  updates: {
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
  },
  ai: {
    chat: request => ipcRenderer.invoke('ai:chat', request),
    onEvent: cb => {
      const handler = (_event: unknown, requestId: string, aiEvent: unknown) =>
        cb(requestId, aiEvent);
      ipcRenderer.on('ai:event', handler);
      return () => {
        ipcRenderer.removeListener('ai:event', handler);
      };
    },
    cancel: requestId => ipcRenderer.invoke('ai:cancel', requestId),
    validate: config => ipcRenderer.invoke('ai:validate', config),
    exportPreset: presetJson => ipcRenderer.invoke('ai:exportPreset', presetJson),
    importPreset: () => ipcRenderer.invoke('ai:importPreset'),
    confirmTool: (requestId: string, callId: string, approved: boolean) =>
      ipcRenderer.invoke('ai:tool-confirm', requestId, callId, approved),
    onToolExecuteRequest: (
      cb: (requestId: string, callId: string, toolName: string, args: unknown) => void
    ) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        requestId: string,
        callId: string,
        toolName: string,
        args: unknown
      ) => cb(requestId, callId, toolName, args);
      ipcRenderer.on('ai:tool-execute-in-renderer', handler);
      return () => {
        ipcRenderer.removeListener('ai:tool-execute-in-renderer', handler);
      };
    },
    sendToolResult: (
      requestId: string,
      callId: string,
      result: { ok: boolean; content: string; error?: string }
    ) => ipcRenderer.invoke('ai:tool-renderer-result', requestId, callId, result),
    saveKey: (provider: string, apiKey: string) =>
      ipcRenderer.invoke('ai:saveKey', provider, apiKey),
    getKey: (provider: string) => ipcRenderer.invoke('ai:getKey', provider),
    removeKey: (provider: string) => ipcRenderer.invoke('ai:removeKey', provider),
    hasKey: (provider: string) => ipcRenderer.invoke('ai:hasKey', provider),
    listConnectedProviders: () => ipcRenderer.invoke('ai:listConnectedProviders'),
  },
  pluginConfig: {
    get: (pluginId, key) => ipcRenderer.invoke('pluginConfig:get', pluginId, key),
    set: (pluginId, key, value) => ipcRenderer.invoke('pluginConfig:set', pluginId, key, value),
    getAll: pluginId => ipcRenderer.invoke('pluginConfig:getAll', pluginId),
    clear: pluginId => ipcRenderer.invoke('pluginConfig:clear', pluginId),
  },
  theme: {
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
  },
  plugins: {
    scan: () => ipcRenderer.invoke('plugins:scan'),
    isEnabled: pluginId => ipcRenderer.invoke('plugins:isEnabled', pluginId),
    setEnabled: (pluginId, enabled) => ipcRenderer.invoke('plugins:setEnabled', pluginId, enabled),
    listState: () => ipcRenderer.invoke('plugins:listState'),
    requestReload: () => ipcRenderer.send('plugins:requestReload'),
    readInitScript: () => ipcRenderer.invoke('plugins:readInitScript'),
    install: () => ipcRenderer.invoke('plugins:install'),
    uninstall: (pluginId: string) => ipcRenderer.invoke('plugins:uninstall', pluginId),
  },
};

contextBridge.exposeInMainWorld('readied', api);

// Type augmentation for window
declare global {
  interface Window {
    readied: ReadiedAPI;
  }
}
