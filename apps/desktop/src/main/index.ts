/**
 * Electron Main Process
 *
 * Initializes the app, database, and IPC handlers.
 */

// Initialize Sentry FIRST (before any other imports that might throw)
// eslint-disable-next-line import-x/order
import { initSentry } from './sentry';
initSentry();

import { join, normalize, basename } from 'path';
import { readFile, writeFile, unlink, mkdir, rm, readdir, stat, rename } from 'fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { exec } from 'child_process';
import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } from 'electron';
import { autoUpdater } from 'electron-updater';
import installExtension, { REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer';
import {
  runMigrations,
  createDataPaths,
  createBackup,
  listBackups,
  restoreBackup,
  exportNotes,
  importNotes,
  detectImportType,
  type DataPaths,
} from '@readied/storage-core';
import {
  createDatabase,
  allMigrations,
  SQLiteNoteRepository,
  SQLiteNotebookRepository,
} from '@readied/storage-sqlite';
import {
  createNoteOperation,
  updateNoteOperation,
  updateTitleOperation,
  deleteNoteOperation,
  getNoteOperation,
  archiveNoteOperation,
  restoreNoteOperation,
  duplicateNoteOperation,
  moveNoteToNotebook,
  pinNote,
  unpinNote,
  softDeleteNote,
  restoreDeletedNote,
  setNoteStatus,
  type NoteStatus,
} from '@readied/core';
import {
  createNoteId,
  createNotebookId,
  createNotebook,
  renameNotebook,
  moveNotebook,
  createTag,
  INBOX_NOTEBOOK_ID,
} from '@readied/core';
import {
  type LicenseStorage,
  type StoredTrialData,
  type StoredLicenseData,
  type StoredSubscriptionData,
} from '@readied/licensing';
import { initLogger, createChildLogger, loggers, getLogger, type LogLevel } from './logger';
import { TokenStorage } from './services/tokenStorage.js';
import { getOrCreateDeviceInfo, type DeviceInfo } from './services/deviceInfo.js';
import { ApiClient } from './services/apiClient.js';
import { EncryptionService } from './services/encryptionService.js';
import { SyncService } from './services/syncService.js';
import { GitService } from './services/gitService.js';
import { registerLicenseHandlers } from './handlers/licenseHandlers.js';
import { registerShareHandlers } from './handlers/shareHandlers.js';
import { scanPlugins } from './pluginScanner.js';
import { startPluginWatcher, stopPluginWatcher } from './pluginWatcher.js';

// Database and repository (initialized on app ready)
let db: ReturnType<typeof createDatabase> | null = null;
let noteRepository: SQLiteNoteRepository | null = null;
let notebookRepository: SQLiteNotebookRepository | null = null;
let dataPaths: DataPaths | null = null;
let licenseStorage: FileLicenseStorage | null = null;

// Backend API services (initialized on app ready)
let tokenStorage: TokenStorage | null = null;
let deviceInfo: DeviceInfo | null = null;
let apiClient: ApiClient | null = null;
let encryptionService: EncryptionService | null = null;
let syncService: SyncService | null = null;
// Git service (initialized on app ready)
let gitService: GitService | null = null;

/** File-based license storage implementation */
class FileLicenseStorage implements LicenseStorage {
  private licensePath: string;
  private trialPath: string;
  private subscriptionPath: string;

  constructor(dataDir: string) {
    this.licensePath = join(dataDir, 'license.json');
    this.trialPath = join(dataDir, 'trial.json');
    this.subscriptionPath = join(dataDir, 'subscription.json');
  }

  async readLicenseData(): Promise<StoredLicenseData | null> {
    try {
      if (!existsSync(this.licensePath)) {
        return null;
      }
      const content = await readFile(this.licensePath, 'utf-8');
      return JSON.parse(content) as StoredLicenseData;
    } catch {
      return null;
    }
  }

  async writeLicenseData(data: StoredLicenseData): Promise<void> {
    await writeFile(this.licensePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async removeLicenseData(): Promise<void> {
    if (existsSync(this.licensePath)) {
      await unlink(this.licensePath);
    }
  }

  async readTrialData(): Promise<StoredTrialData | null> {
    try {
      if (!existsSync(this.trialPath)) {
        return null;
      }
      const content = await readFile(this.trialPath, 'utf-8');
      return JSON.parse(content) as StoredTrialData;
    } catch {
      return null;
    }
  }

  async writeTrialData(data: StoredTrialData): Promise<void> {
    await writeFile(this.trialPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async readSubscriptionData(): Promise<StoredSubscriptionData | null> {
    try {
      if (!existsSync(this.subscriptionPath)) {
        return null;
      }
      const content = await readFile(this.subscriptionPath, 'utf-8');
      return JSON.parse(content) as StoredSubscriptionData;
    } catch {
      return null;
    }
  }

  async writeSubscriptionData(data: StoredSubscriptionData): Promise<void> {
    await writeFile(this.subscriptionPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async removeSubscriptionData(): Promise<void> {
    if (existsSync(this.subscriptionPath)) {
      await unlink(this.subscriptionPath);
    }
  }
}

// ============================================================================
// Window State Persistence
// ============================================================================

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized?: boolean;
}

const DEFAULT_WINDOW_STATE: WindowState = {
  width: 1200,
  height: 800,
};

function getWindowStatePath(): string {
  return join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState(): WindowState {
  try {
    const data = readFileSync(getWindowStatePath(), 'utf-8');
    return { ...DEFAULT_WINDOW_STATE, ...JSON.parse(data) };
  } catch {
    return DEFAULT_WINDOW_STATE;
  }
}

function saveWindowState(state: WindowState): void {
  try {
    writeFileSync(getWindowStatePath(), JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('Failed to save window state:', err);
  }
}

/** Initialize data paths */
function initDataPaths(): DataPaths {
  const userDataPath = app.getPath('userData');
  return createDataPaths(userDataPath);
}

/** Initialize the database */
function initDatabase(): void {
  if (!dataPaths) {
    throw new Error('Data paths not initialized');
  }

  const dbLog = loggers.database();
  dbLog.info({ path: dataPaths.database }, 'Database path');

  db = createDatabase(dataPaths.database);
  runMigrations(db, allMigrations);
  noteRepository = new SQLiteNoteRepository(db);
  notebookRepository = new SQLiteNotebookRepository(db);

  // Initialize Git service for git-backed notebooks
  gitService = new GitService(dataPaths.root);

  dbLog.info('Database initialized');
}

/** Create the main window */
function createWindow(): void {
  // Load saved window state
  const windowState = loadWindowState();

  const mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 8, y: 8 },
    backgroundColor: '#0a0b0d',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for better-sqlite3
    },
  });

  // Restore maximized state after window is created
  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  // Save window state on resize/move/close (debounced)
  let saveTimeout: NodeJS.Timeout | null = null;
  const debouncedSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      if (!mainWindow.isDestroyed() && !mainWindow.isMaximized()) {
        const bounds = mainWindow.getBounds();
        saveWindowState({
          ...bounds,
          isMaximized: false,
        });
      }
    }, 500);
  };

  mainWindow.on('resize', debouncedSave);
  mainWindow.on('move', debouncedSave);

  mainWindow.on('maximize', () => {
    saveWindowState({
      ...mainWindow.getBounds(),
      isMaximized: true,
    });
  });

  mainWindow.on('unmaximize', () => {
    const bounds = mainWindow.getBounds();
    saveWindowState({
      ...bounds,
      isMaximized: false,
    });
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  // Load renderer
  if (process.env.NODE_ENV === 'development' && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

/** Create a new window for viewing a single note */
function createNoteWindow(noteId: string, noteTitle: string): void {
  const noteWindow = new BrowserWindow({
    width: 800,
    height: 700,
    minWidth: 500,
    minHeight: 400,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 8, y: 8 },
    backgroundColor: '#0a0b0d',
    title: noteTitle || 'Note',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  noteWindow.on('ready-to-show', () => {
    noteWindow.show();
    if (process.env.NODE_ENV === 'development') {
      noteWindow.webContents.openDevTools();
    }
  });

  // Load renderer with note ID in query param
  const query = `?noteWindow=${encodeURIComponent(noteId)}`;
  if (process.env.NODE_ENV === 'development' && process.env.ELECTRON_RENDERER_URL) {
    noteWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}${query}`);
  } else {
    noteWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { noteWindow: noteId },
    });
  }
}

/** Settings window singleton */
let settingsWindow: BrowserWindow | null = null;

/** Create or focus the settings window */
function createSettingsWindow(): void {
  // If window exists, focus it
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 720,
    height: 520,
    minWidth: 620,
    minHeight: 460,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 8, y: 8 },
    backgroundColor: '#0a0b0d',
    title: 'Settings',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  settingsWindow.on('ready-to-show', () => {
    settingsWindow?.show();
    if (process.env.NODE_ENV === 'development') {
      settingsWindow?.webContents.openDevTools();
    }
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  // Load settings page via query param (same index.html, different view)
  if (process.env.NODE_ENV === 'development' && process.env.ELECTRON_RENDERER_URL) {
    const settingsUrl = `${process.env.ELECTRON_RENDERER_URL}?view=settings`;
    settingsWindow.loadURL(settingsUrl);
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { view: 'settings' },
    });
  }
}

/** Helper to convert a Note to a snapshot for IPC */
function noteToSnapshot(note: {
  id: string;
  notebookId: string;
  content: string;
  title: string;
  isPinned: boolean;
  isDeleted: boolean;
  status: NoteStatus;
  metadata: {
    createdAt: string;
    updatedAt: string;
    tags: readonly string[];
    wordCount: number;
    archivedAt: string | null;
  };
}) {
  return {
    id: note.id,
    notebookId: note.notebookId,
    content: note.content,
    title: note.title,
    createdAt: note.metadata.createdAt,
    updatedAt: note.metadata.updatedAt,
    tags: [...note.metadata.tags],
    wordCount: note.metadata.wordCount,
    archivedAt: note.metadata.archivedAt,
    isArchived: note.metadata.archivedAt !== null,
    isPinned: note.isPinned,
    isDeleted: note.isDeleted,
    status: note.status,
  };
}

/** Register IPC handlers for notes CRUD */
function registerIpcHandlers(): void {
  if (!noteRepository) {
    throw new Error('Note repository not initialized');
  }

  const repo = noteRepository;

  // Create note
  ipcMain.handle(
    'notes:create',
    async (_event, input: { content: string; id?: string; notebookId?: string }) => {
      return createNoteOperation(input, repo);
    }
  );

  // Get note
  ipcMain.handle('notes:get', async (_event, id: string) => {
    const noteId = createNoteId(id);
    return getNoteOperation({ id: noteId }, repo);
  });

  // Update note content
  ipcMain.handle('notes:update', async (_event, input: { id: string; content: string }) => {
    const noteId = createNoteId(input.id);
    return updateNoteOperation({ id: noteId, content: input.content }, repo);
  });

  // Update note title (structural, independent from content)
  ipcMain.handle('notes:updateTitle', async (_event, input: { id: string; title: string }) => {
    const noteId = createNoteId(input.id);
    return updateTitleOperation({ id: noteId, title: input.title }, repo);
  });

  // Delete note
  ipcMain.handle('notes:delete', async (_event, id: string) => {
    const noteId = createNoteId(id);
    return deleteNoteOperation({ id: noteId }, repo);
  });

  // Archive note
  ipcMain.handle('notes:archive', async (_event, id: string) => {
    const noteId = createNoteId(id);
    return archiveNoteOperation({ id: noteId }, repo);
  });

  // Restore note
  ipcMain.handle('notes:restore', async (_event, id: string) => {
    const noteId = createNoteId(id);
    return restoreNoteOperation({ id: noteId }, repo);
  });

  // Duplicate note
  ipcMain.handle('notes:duplicate', async (_event, id: string) => {
    const noteId = createNoteId(id);
    return duplicateNoteOperation({ id: noteId }, repo);
  });

  // Move note to notebook
  ipcMain.handle('notes:move', async (_event, noteId: string, notebookId: string) => {
    const note = await repo.get(createNoteId(noteId));
    if (!note) {
      return { ok: false, error: { type: 'NOT_FOUND', id: noteId } };
    }

    const movedNote = moveNoteToNotebook(note, createNotebookId(notebookId));
    await repo.save(movedNote);

    return {
      ok: true,
      data: noteToSnapshot(movedNote),
    };
  });

  // Pin note
  ipcMain.handle('notes:pin', async (_event, id: string) => {
    const note = await repo.get(createNoteId(id));
    if (!note) {
      return { ok: false, error: { type: 'NOT_FOUND', id } };
    }

    const pinnedNote = pinNote(note);
    await repo.save(pinnedNote);

    return { ok: true, data: noteToSnapshot(pinnedNote) };
  });

  // Unpin note
  ipcMain.handle('notes:unpin', async (_event, id: string) => {
    const note = await repo.get(createNoteId(id));
    if (!note) {
      return { ok: false, error: { type: 'NOT_FOUND', id } };
    }

    const unpinnedNote = unpinNote(note);
    await repo.save(unpinnedNote);

    return { ok: true, data: noteToSnapshot(unpinnedNote) };
  });

  // Soft delete (move to trash)
  ipcMain.handle('notes:softDelete', async (_event, id: string) => {
    const note = await repo.get(createNoteId(id));
    if (!note) {
      return { ok: false, error: { type: 'NOT_FOUND', id } };
    }

    const deletedNote = softDeleteNote(note);
    await repo.save(deletedNote);

    return { ok: true, data: noteToSnapshot(deletedNote) };
  });

  // Restore from trash
  ipcMain.handle('notes:restoreDeleted', async (_event, id: string) => {
    const note = await repo.get(createNoteId(id));
    if (!note) {
      return { ok: false, error: { type: 'NOT_FOUND', id } };
    }

    const restoredNote = restoreDeletedNote(note);
    await repo.save(restoredNote);

    return { ok: true, data: noteToSnapshot(restoredNote) };
  });

  // Set note status
  ipcMain.handle('notes:setStatus', async (_event, id: string, status: NoteStatus) => {
    const note = await repo.get(createNoteId(id));
    if (!note) {
      return { ok: false, error: { type: 'NOT_FOUND', id } };
    }

    const updatedNote = setNoteStatus(note, status);
    await repo.save(updatedNote);

    return { ok: true, data: noteToSnapshot(updatedNote) };
  });

  // List notes
  ipcMain.handle(
    'notes:list',
    async (
      _event,
      options?: {
        limit?: number;
        offset?: number;
        tag?: string;
        sortBy?: 'createdAt' | 'updatedAt' | 'title';
        sortOrder?: 'asc' | 'desc';
        archived?: 'active' | 'archived' | 'all';
      }
    ) => {
      const notes = await repo.list(options);
      return notes.map(note => noteToSnapshot(note));
    }
  );

  // Search notes
  ipcMain.handle('notes:search', async (_event, query: string, limit?: number) => {
    const notes = await repo.search(query, limit);
    return notes.map(note => noteToSnapshot(note));
  });

  // Get all tags
  ipcMain.handle('notes:tags', async () => {
    return repo.getAllTags();
  });

  // Set manual tags (full replacement)
  ipcMain.handle('notes:setManualTags', async (_event, noteId: string, tags: string[]) => {
    const id = createNoteId(noteId);
    // Normalize tags: trim, lowercase, strip leading '#', remove empties, dedupe
    const normalizedTags = [
      ...new Set(tags.map(t => t.trim().toLowerCase().replace(/^#/, '')).filter(t => t.length > 0)),
    ];
    repo.setManualTags(
      id,
      normalizedTags.map(t => createTag(t))
    );
    return { ok: true };
  });

  // Get manual tags only (for editor to know which are removable)
  ipcMain.handle('notes:getManualTags', async (_event, noteId: string) => {
    const id = createNoteId(noteId);
    return repo.getManualTags(id);
  });

  // Get all tags with colors
  ipcMain.handle('tags:listWithColors', async () => {
    return repo.getAllTagsWithColors();
  });

  // Set tag color
  ipcMain.handle('tags:setColor', async (_event, tagName: string, color: string | null) => {
    repo.setTagColor(tagName, color);
    return { ok: true };
  });

  // Delete tag from system
  ipcMain.handle('tags:delete', async (_event, tagName: string) => {
    repo.deleteTag(tagName);
    return { ok: true };
  });

  // Rename tag across all notes
  ipcMain.handle('tags:rename', async (_event, oldName: string, newName: string) => {
    return repo.renameTag(oldName, newName);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Links (Wikilinks / Backlinks)
  // ═══════════════════════════════════════════════════════════════════════════

  // Sync links for a note (call after saving note)
  ipcMain.handle('links:sync', async (_event, noteId: string, content: string) => {
    repo.syncLinks(createNoteId(noteId), content);
    return { ok: true };
  });

  // Get backlinks (notes that link TO this note)
  ipcMain.handle('links:backlinks', async (_event, noteId: string) => {
    return repo.getBacklinks(createNoteId(noteId));
  });

  // Get outgoing links (notes this note links TO)
  ipcMain.handle('links:outgoing', async (_event, noteId: string) => {
    return repo.getOutgoingLinks(createNoteId(noteId));
  });

  // Get graph data (all notes and links for visualization)
  ipcMain.handle('links:graph', async () => {
    try {
      return repo.getGraphData();
    } catch (error) {
      console.error('Failed to get graph data:', error);
      // Return empty data on error
      return { nodes: [], edges: [] };
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Window Management
  // ═══════════════════════════════════════════════════════════════════════════

  // Open a note in a new window
  ipcMain.handle('window:openNote', async (_event, noteId: string, noteTitle: string) => {
    createNoteWindow(noteId, noteTitle);
    return { ok: true };
  });

  // Open settings window
  ipcMain.handle('window:openSettings', async () => {
    createSettingsWindow();
    return { ok: true };
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Embeds (File Resolution)
  // ═══════════════════════════════════════════════════════════════════════════

  // Resolve embed target to asset:// URL
  ipcMain.handle('embeds:resolve', async (_event, target: string, noteId: string) => {
    if (!dataPaths) return null;

    // Build path to note's assets folder: /assets/{noteId}/{target}
    const assetPath = join(dataPaths.assets, noteId, target);

    // Check if file exists
    if (existsSync(assetPath)) {
      // Return asset:// URL with host (required for browser to recognize protocol)
      return `asset://local/${noteId}/${target}`;
    }

    // File not found
    return null;
  });

  // Batch resolve multiple embed targets (more efficient)
  ipcMain.handle(
    'embeds:resolveBatch',
    async (_event, targets: string[], noteId: string): Promise<Record<string, string | null>> => {
      if (!dataPaths) return {};

      const result: Record<string, string | null> = {};
      for (const target of targets) {
        const assetPath = join(dataPaths.assets, noteId, target);
        // Return asset:// URL with host (required for browser to recognize protocol)
        result[target] = existsSync(assetPath) ? `asset://local/${noteId}/${target}` : null;
      }
      return result;
    }
  );

  // Save asset (image/file) for a note via drag & drop or paste
  ipcMain.handle(
    'embeds:saveAsset',
    async (
      _event,
      noteId: string,
      mime: string,
      bytes: ArrayBuffer,
      originalName?: string
    ): Promise<{ ok: true; filename: string; relPath: string } | { ok: false; error: string }> => {
      if (!dataPaths) {
        return { ok: false, error: 'Data paths not initialized' };
      }

      // Validate noteId (non-empty, alphanumeric with hyphens/underscores)
      if (!noteId || !/^[\w-]+$/.test(noteId)) {
        return { ok: false, error: 'Invalid noteId' };
      }

      // Validate size (max 20MB)
      const MAX_SIZE = 20 * 1024 * 1024;
      if (bytes.byteLength > MAX_SIZE) {
        return { ok: false, error: 'File too large (max 20MB)' };
      }

      // Derive extension from mime type
      const mimeToExt: Record<string, string> = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
        'image/bmp': 'bmp',
        'image/ico': 'ico',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'video/quicktime': 'mov',
        'audio/mpeg': 'mp3',
        'audio/wav': 'wav',
        'audio/ogg': 'ogg',
        'application/pdf': 'pdf',
      };

      let ext = mimeToExt[mime];
      if (!ext && originalName) {
        // Fallback to originalName extension
        const match = originalName.match(/\.([a-zA-Z0-9]+)$/);
        ext = match?.[1]?.toLowerCase() ?? 'bin';
      }
      if (!ext) {
        ext = 'bin';
      }

      // Generate unique filename: timestamp-random.ext
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const filename = `${timestamp}-${random}.${ext}`;

      // Ensure note's assets directory exists
      const noteAssetsDir = join(dataPaths.assets, noteId);
      await mkdir(noteAssetsDir, { recursive: true });

      // Write file
      const assetPath = join(noteAssetsDir, filename);
      await writeFile(assetPath, Buffer.from(bytes));

      return {
        ok: true,
        filename,
        relPath: `${noteId}/${filename}`,
      };
    }
  );

  // Count notes
  ipcMain.handle('notes:count', async () => {
    // Get all notes to compute counts
    const allNotes = await repo.list({ archived: 'all' });

    const counts = {
      active: 0,
      archived: 0,
      total: allNotes.length,
      pinned: 0,
      deleted: 0,
      byStatus: {
        active: 0,
        on_hold: 0,
        completed: 0,
        dropped: 0,
      } as Record<NoteStatus, number>,
      byNotebook: {} as Record<string, number>,
    };

    for (const note of allNotes) {
      // Count archived
      if (note.metadata.archivedAt !== null) {
        counts.archived++;
      } else {
        counts.active++;
      }

      // Count pinned
      if (note.isPinned) {
        counts.pinned++;
      }

      // Count deleted (in trash)
      if (note.isDeleted) {
        counts.deleted++;
      }

      // Count by status
      if (note.status && counts.byStatus[note.status] !== undefined) {
        counts.byStatus[note.status]++;
      }

      // Count by notebook (active, non-deleted notes only)
      if (note.notebookId && !note.isDeleted && !note.metadata.archivedAt) {
        counts.byNotebook[note.notebookId] = (counts.byNotebook[note.notebookId] || 0) + 1;
      }
    }

    return counts;
  });
}

/** Register IPC handlers for notebooks CRUD */
function registerNotebookHandlers(): void {
  if (!notebookRepository) {
    throw new Error('Notebook repository not initialized');
  }

  const repo = notebookRepository;

  // List all notebooks
  ipcMain.handle('notebooks:list', async () => {
    const notebooks = await repo.getAll();
    return notebooks.map(nb => ({
      id: nb.id,
      name: nb.name,
      parentId: nb.parentId,
      depth: nb.depth,
      order: nb.order,
      createdAt: nb.createdAt,
      updatedAt: nb.updatedAt,
    }));
  });

  // Get notebook tree
  ipcMain.handle('notebooks:tree', async () => {
    return repo.getTree();
  });

  // Get single notebook
  ipcMain.handle('notebooks:get', async (_event, id: string) => {
    const notebook = await repo.get(createNotebookId(id));
    if (!notebook) return null;
    return {
      id: notebook.id,
      name: notebook.name,
      parentId: notebook.parentId,
      depth: notebook.depth,
      order: notebook.order,
      createdAt: notebook.createdAt,
      updatedAt: notebook.updatedAt,
    };
  });

  // Get notebook with metadata
  ipcMain.handle('notebooks:getWithMetadata', async (_event, id: string) => {
    const notebook = await repo.getWithMetadata(createNotebookId(id));
    if (!notebook) return null;
    return {
      id: notebook.id,
      name: notebook.name,
      parentId: notebook.parentId,
      depth: notebook.depth,
      order: notebook.order,
      createdAt: notebook.createdAt,
      updatedAt: notebook.updatedAt,
      noteCount: notebook.noteCount,
      childCount: notebook.childCount,
    };
  });

  // Create notebook
  ipcMain.handle('notebooks:create', async (_event, input: { name: string; parentId?: string }) => {
    let parentDepth = 0;
    if (input.parentId) {
      const parent = await repo.get(createNotebookId(input.parentId));
      if (parent) {
        parentDepth = parent.depth;
      }
    }

    const nextOrder = await repo.getNextOrder(
      input.parentId ? createNotebookId(input.parentId) : null
    );

    const notebook = createNotebook({
      name: input.name,
      parentId: input.parentId ? createNotebookId(input.parentId) : null,
      parentDepth,
      order: nextOrder,
    });

    await repo.save(notebook);

    return {
      id: notebook.id,
      name: notebook.name,
      parentId: notebook.parentId,
      depth: notebook.depth,
      order: notebook.order,
      createdAt: notebook.createdAt,
      updatedAt: notebook.updatedAt,
    };
  });

  // Rename notebook
  ipcMain.handle('notebooks:rename', async (_event, id: string, name: string) => {
    const notebook = await repo.get(createNotebookId(id));
    if (!notebook) {
      throw new Error('Notebook not found');
    }

    const updated = renameNotebook(notebook, name);
    await repo.save(updated);

    return {
      id: updated.id,
      name: updated.name,
      parentId: updated.parentId,
      depth: updated.depth,
      order: updated.order,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  });

  // Move notebook
  ipcMain.handle('notebooks:move', async (_event, id: string, newParentId: string | null) => {
    const notebook = await repo.get(createNotebookId(id));
    if (!notebook) {
      throw new Error('Notebook not found');
    }

    let newParentDepth = 0;
    if (newParentId) {
      const parent = await repo.get(createNotebookId(newParentId));
      if (parent) {
        newParentDepth = parent.depth;
      }
    }

    const result = moveNotebook(
      notebook,
      newParentId ? createNotebookId(newParentId) : null,
      newParentDepth
    );

    if (!result.success) {
      throw new Error(result.reason);
    }

    await repo.save(result.notebook);

    return {
      id: result.notebook.id,
      name: result.notebook.name,
      parentId: result.notebook.parentId,
      depth: result.notebook.depth,
      order: result.notebook.order,
      createdAt: result.notebook.createdAt,
      updatedAt: result.notebook.updatedAt,
    };
  });

  // Delete notebook
  ipcMain.handle('notebooks:delete', async (_event, id: string) => {
    const notebookId = createNotebookId(id);

    if (notebookId === INBOX_NOTEBOOK_ID) {
      throw new Error('Cannot delete Inbox notebook');
    }

    await repo.delete(notebookId);
    return { success: true };
  });

  // Reorder notebooks within a parent
  ipcMain.handle(
    'notebooks:reorder',
    async (_event, parentId: string | null, orderedIds: string[]) => {
      await repo.reorder(
        parentId ? createNotebookId(parentId) : null,
        orderedIds.map(id => createNotebookId(id))
      );
      return { success: true };
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Git Operations
  // ═══════════════════════════════════════════════════════════════════════════

  // Enable git for a notebook
  ipcMain.handle('notebooks:enableGit', async (_event, notebookId: string) => {
    try {
      repo.enableGit(createNotebookId(notebookId));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enable git',
      };
    }
  });

  // Disable git for a notebook
  ipcMain.handle('notebooks:disableGit', async (_event, notebookId: string) => {
    try {
      repo.disableGit(createNotebookId(notebookId));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disable git',
      };
    }
  });

  // Check if git is enabled for a notebook
  ipcMain.handle('notebooks:isGitEnabled', async (_event, notebookId: string) => {
    try {
      const enabled = repo.isGitEnabled(createNotebookId(notebookId));
      return { success: true, enabled };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check git status',
      };
    }
  });

  // Get git settings for a notebook
  ipcMain.handle('notebooks:getGitSettings', async (_event, notebookId: string) => {
    try {
      const settings = repo.getGitSettings(createNotebookId(notebookId));
      return { success: true, settings };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get git settings',
      };
    }
  });

  // Toggle auto-commit for a notebook
  ipcMain.handle(
    'notebooks:setGitAutoCommit',
    async (_event, notebookId: string, enabled: boolean) => {
      try {
        repo.setGitAutoCommit(createNotebookId(notebookId), enabled);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to set auto-commit',
        };
      }
    }
  );

  // Get all git-enabled notebooks
  ipcMain.handle('notebooks:getGitEnabled', async () => {
    try {
      const notebooks = repo.getGitEnabledNotebooks();
      return {
        success: true,
        notebooks: notebooks.map(nb => ({
          id: nb.id,
          name: nb.name,
          parentId: nb.parentId,
          depth: nb.depth,
          order: nb.order,
          createdAt: nb.createdAt,
          updatedAt: nb.updatedAt,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get git-enabled notebooks',
      };
    }
  });
}

/** Register IPC handlers for data management (backup, export, import) */
function registerDataHandlers(): void {
  if (!dataPaths || !noteRepository) {
    throw new Error('Data paths or repository not initialized');
  }

  const paths = dataPaths;
  const repo = noteRepository;

  // Create backup
  ipcMain.handle('data:backup', async () => {
    return createBackup({
      backupDir: paths.backups,
      databasePath: paths.database,
    });
  });

  // List backups
  ipcMain.handle('data:backups:list', async () => {
    return listBackups(paths.backups);
  });

  // Restore from backup
  ipcMain.handle('data:backup:restore', async (_event, backupPath: string) => {
    // Close current database connection
    if (db) {
      db.close();
    }

    const result = restoreBackup(backupPath, paths.database);

    // Reconnect to database
    db = createDatabase(paths.database);
    runMigrations(db, allMigrations);

    return result;
  });

  // Export notes
  ipcMain.handle('data:export', async () => {
    // Show save dialog
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Export Notes',
      defaultPath: join(app.getPath('documents'), 'readied-export'),
      buttonLabel: 'Export',
    });

    if (canceled || !filePath) {
      return { success: false, error: 'Export cancelled' };
    }

    // Get all notes
    const notes = await repo.list({ archived: 'all' });
    const snapshots = notes.map(note => ({
      id: note.id,
      content: note.content,
      title: note.title, // Use structural title
      createdAt: note.metadata.createdAt,
      updatedAt: note.metadata.updatedAt,
      tags: [...note.metadata.tags],
      wordCount: note.metadata.wordCount,
      archivedAt: note.metadata.archivedAt,
    }));

    const result = exportNotes(snapshots, {
      outputDir: filePath,
      appVersion: app.getVersion(),
      includeArchived: true,
    });

    if (result.success) {
      // Open the export folder
      shell.showItemInFolder(filePath);
    }

    return result;
  });

  // Import notes
  ipcMain.handle('data:import', async () => {
    // Show folder selection dialog
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Import Notes',
      properties: ['openDirectory'],
      buttonLabel: 'Import',
    });

    const sourceDir = filePaths[0];
    if (canceled || !sourceDir) {
      return { success: false, error: 'Import cancelled' };
    }

    const importType = detectImportType(sourceDir);

    const result = importNotes({
      sourceDir,
      type: importType,
      recursive: true,
    });

    if (!result.success || !result.notes) {
      return result;
    }

    // Import each note
    let imported = 0;
    for (const imported_note of result.notes) {
      try {
        await createNoteOperation(
          {
            content: imported_note.content,
          },
          repo
        );
        imported++;
      } catch {
        // Skip notes that fail to import
      }
    }

    return {
      success: true,
      noteCount: imported,
      skipped: result.skipped,
    };
  });

  // Get data paths info
  ipcMain.handle('data:paths', async () => {
    return {
      root: paths.root,
      database: paths.database,
      backups: paths.backups,
      logs: paths.logs,
    };
  });

  // Open data folder in system file manager
  ipcMain.handle('data:openFolder', async () => {
    shell.openPath(paths.root);
    return { success: true };
  });
}

/** Register IPC handlers for renderer logging */
function registerLogHandlers(): void {
  const rendererLogger = createChildLogger({ component: 'renderer' });

  // Log from renderer
  ipcMain.handle(
    'log:write',
    async (
      _event,
      level: LogLevel,
      message: string,
      context?: Record<string, unknown>
    ): Promise<{ success: boolean }> => {
      const childLogger = context ? rendererLogger.child(context) : rendererLogger;

      switch (level) {
        case 'debug':
          childLogger.debug(message);
          break;
        case 'info':
          childLogger.info(message);
          break;
        case 'warn':
          childLogger.warn(message);
          break;
        case 'error':
          childLogger.error(message);
          break;
      }

      return { success: true };
    }
  );

  // Get log file path (for debugging/support)
  ipcMain.handle('log:getPath', async (): Promise<string | null> => {
    return dataPaths?.logs ?? null;
  });
}

/** Register IPC handlers for manual update checks */
function registerUpdateHandlers(): void {
  // Manual check for updates
  ipcMain.handle(
    'updates:checkNow',
    async (): Promise<{ available: boolean; version?: string }> => {
      // In development or without proper updater config, return mock response
      if (process.env.NODE_ENV === 'development') {
        return { available: false };
      }

      // Event-based pattern: autoUpdater emits events, we wrap in Promise
      return new Promise(resolve => {
        const onAvailable = (info: { version: string }) => {
          cleanup();
          resolve({ available: true, version: info.version });
        };

        const onNotAvailable = () => {
          cleanup();
          resolve({ available: false });
        };

        const onError = () => {
          cleanup();
          resolve({ available: false });
        };

        const cleanup = () => {
          autoUpdater.removeListener('update-available', onAvailable);
          autoUpdater.removeListener('update-not-available', onNotAvailable);
          autoUpdater.removeListener('error', onError);
        };

        autoUpdater.once('update-available', onAvailable);
        autoUpdater.once('update-not-available', onNotAvailable);
        autoUpdater.once('error', onError);

        autoUpdater.checkForUpdates().catch(() => {
          cleanup();
          resolve({ available: false });
        });
      });
    }
  );

  ipcMain.handle('updates:startDownload', async () => {
    if (process.env.NODE_ENV === 'development') return { ok: false };
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (err) {
      loggers.updater().error({ error: (err as Error).message }, 'Failed to download update');
      return { ok: false };
    }
  });

  ipcMain.handle('updates:installNow', () => {
    // Force-close all windows so macOS doesn't block the quit
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) win.destroy();
    });
    autoUpdater.quitAndInstall(false, true);
  });
}

/** Register IPC handlers for authentication and sync */
function registerAuthSyncHandlers(): void {
  if (!apiClient || !tokenStorage || !syncService) {
    throw new Error('API client, token storage, or sync service not initialized');
  }

  const client = apiClient;
  const storage = tokenStorage;
  const sync = syncService;

  // ═══════════════════════════════════════════════════════════════════════════
  // Authentication
  // ═══════════════════════════════════════════════════════════════════════════

  // Request magic link email
  ipcMain.handle('auth:requestMagicLink', async (_event, email: string) => {
    try {
      await client.requestMagicLink(email);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to request magic link',
      };
    }
  });

  // Verify magic link token and save tokens
  ipcMain.handle('auth:verify', async (_event, token: string) => {
    try {
      const result = await client.verifyMagicLink(token);
      await storage.saveTokens(result.accessToken, result.refreshToken);
      return { success: true, user: result.user };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify token',
      };
    }
  });

  // Get current session
  ipcMain.handle('auth:getSession', async () => {
    try {
      const hasTokens = await storage.hasTokens();
      if (!hasTokens) {
        return null;
      }

      const user = await client.getCurrentUser();
      return { user };
    } catch (_error) {
      // If session is invalid, clear tokens
      await storage.clearTokens();
      return null;
    }
  });

  // Logout and clear tokens
  ipcMain.handle('auth:logout', async () => {
    try {
      await storage.clearTokens();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to logout',
      };
    }
  });

  // Refresh access token
  ipcMain.handle('auth:refreshToken', async () => {
    try {
      const refreshed = await client.refreshAccessToken();
      return { success: refreshed };
    } catch (_error) {
      return { success: false };
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Sync
  // ═══════════════════════════════════════════════════════════════════════════

  // Pull changes from server
  ipcMain.handle('sync:pull', async () => {
    try {
      const result = await sync.pull();
      return {
        success: result.success,
        changes: result.changes,
        cursor: result.cursor,
        hasMore: result.hasMore,
        conflicts: result.conflicts,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pull changes',
      };
    }
  });

  // Push changes to server
  ipcMain.handle(
    'sync:push',
    async (
      _event,
      changes: Array<{
        noteId: string;
        operation: 'create' | 'update' | 'delete';
        content?: string;
        localVersion?: number;
      }>
    ) => {
      try {
        const result = await sync.push(changes);
        return {
          success: result.success,
          results: result.results,
          error: result.error,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to push changes',
        };
      }
    }
  );

  // Perform full sync (pull + push)
  ipcMain.handle('sync:syncNow', async () => {
    try {
      const result = await sync.syncNow();
      return result;
    } catch (error) {
      return {
        success: false,
        changesApplied: 0,
        changesPushed: 0,
        conflicts: [],
        error: error instanceof Error ? error.message : 'Sync failed',
      };
    }
  });

  // Get sync status
  ipcMain.handle('sync:status', async () => {
    try {
      const state = sync.getState();
      return {
        success: true,
        cursor: state.cursor,
        lastSyncAt: state.lastSyncAt,
        isSyncing: state.isSyncing,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get sync status',
      };
    }
  });

  // Resolve conflict
  ipcMain.handle(
    'sync:resolveConflict',
    async (_event, noteId: string, resolution: 'local' | 'remote') => {
      try {
        await sync.resolveConflict(noteId, resolution);
        return {
          success: true,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to resolve conflict',
        };
      }
    }
  );

  // Start auto-sync
  ipcMain.handle('sync:startAutoSync', async (_event, intervalMs?: number) => {
    try {
      sync.startAutoSync(intervalMs);
      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start auto-sync',
      };
    }
  });

  // Stop auto-sync
  ipcMain.handle('sync:stopAutoSync', async () => {
    try {
      sync.stopAutoSync();
      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop auto-sync',
      };
    }
  });

  // Tag sync - pull
  ipcMain.handle('sync:pullTags', async () => {
    try {
      return await sync.pullTags();
    } catch (error) {
      return { success: false, applied: 0, error: String(error) };
    }
  });

  // Tag sync - push
  ipcMain.handle('sync:pushTags', async () => {
    try {
      return await sync.pushTags();
    } catch (error) {
      return { success: false, pushed: 0, error: String(error) };
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Subscription
  // ═══════════════════════════════════════════════════════════════════════════

  // Get subscription status
  ipcMain.handle('subscription:getStatus', async () => {
    try {
      const status = await client.getSubscriptionStatus();
      return {
        success: true,
        status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get subscription status',
      };
    }
  });

  // Open Stripe billing portal
  ipcMain.handle('subscription:openPortal', async (_event, returnUrl: string) => {
    try {
      const { url } = await client.createPortalSession(returnUrl);
      shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open billing portal',
      };
    }
  });

  // Open checkout (placeholder - opens pricing page)
  ipcMain.handle('subscription:openCheckout', async () => {
    try {
      shell.openExternal('https://readied.app/pricing');
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open checkout',
      };
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Devices
  // ═══════════════════════════════════════════════════════════════════════════

  ipcMain.handle('devices:list', async () => {
    try {
      const result = await client.listDevices();
      return result.devices;
    } catch (error) {
      return [];
    }
  });

  ipcMain.handle('devices:rename', async (_event, deviceId: string, name: string) => {
    try {
      await client.renameDevice(deviceId, name);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to rename device',
      };
    }
  });

  ipcMain.handle('devices:revoke', async (_event, deviceId: string) => {
    try {
      await client.revokeDevice(deviceId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to revoke device',
      };
    }
  });

  ipcMain.handle('devices:revokeOthers', async () => {
    try {
      const result = await client.revokeOtherDevices();
      return { success: true, revokedCount: result.revokedCount };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to revoke devices',
      };
    }
  });

  ipcMain.handle('devices:getCurrent', async () => {
    try {
      const result = await client.listDevices();
      return result.devices.find((d) => d.isCurrent) ?? null;
    } catch (_error) {
      return null;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Encryption Key Management
  // ═══════════════════════════════════════════════════════════════════════════

  // Export encryption key (for backup)
  ipcMain.handle('encryption:exportKey', async () => {
    try {
      if (!encryptionService) {
        throw new Error('Encryption service not initialized');
      }
      const keyHex = encryptionService.exportKey();
      return {
        success: true,
        key: keyHex,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export encryption key',
      };
    }
  });

  // Import encryption key (for restore)
  ipcMain.handle('encryption:importKey', async (_event, keyHex: string) => {
    try {
      if (!encryptionService) {
        throw new Error('Encryption service not initialized');
      }
      await encryptionService.importKey(keyHex);
      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import encryption key',
      };
    }
  });
}

/** Register IPC handlers for git operations */
function registerGitHandlers(): void {
  if (!gitService) {
    throw new Error('Git service not initialized');
  }

  const git = gitService;

  // Initialize git repository for a notebook
  ipcMain.handle('git:init', async (_event, notebookId: string) => {
    try {
      const repoPath = await git.initRepository(notebookId);
      return {
        success: true,
        repoPath,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize git repository',
      };
    }
  });

  // Check if notebook has git repository
  ipcMain.handle('git:isRepo', async (_event, notebookId: string) => {
    try {
      const isRepo = await git.isGitRepository(notebookId);
      return { success: true, isRepo };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check git repository',
      };
    }
  });

  // Commit changes
  ipcMain.handle(
    'git:commit',
    async (_event, notebookId: string, message: string, files?: string[]) => {
      try {
        const sha = await git.commit(notebookId, message, files);
        return {
          success: true,
          sha,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to commit changes',
        };
      }
    }
  );

  // Get commit history
  ipcMain.handle('git:log', async (_event, notebookId: string, limit?: number) => {
    try {
      const commits = await git.log(notebookId, limit);
      return {
        success: true,
        commits,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get commit history',
      };
    }
  });

  // Get repository status
  ipcMain.handle('git:status', async (_event, notebookId: string) => {
    try {
      const status = await git.status(notebookId);
      return {
        success: true,
        status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get repository status',
      };
    }
  });

  // Checkout (revert to) a specific commit
  ipcMain.handle('git:checkout', async (_event, notebookId: string, commitSha: string) => {
    try {
      await git.checkout(notebookId, commitSha);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to checkout commit',
      };
    }
  });

  // Write note file to git repository
  ipcMain.handle(
    'git:writeNote',
    async (_event, notebookId: string, noteId: string, content: string) => {
      try {
        await git.writeNoteFile(notebookId, noteId, content);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to write note file',
        };
      }
    }
  );

  // Read note file from git repository
  ipcMain.handle('git:readNote', async (_event, notebookId: string, noteId: string) => {
    try {
      const content = await git.readNoteFile(notebookId, noteId);
      return {
        success: true,
        content,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read note file',
      };
    }
  });

  // Delete note file from git repository
  ipcMain.handle('git:deleteNote', async (_event, notebookId: string, noteId: string) => {
    try {
      await git.deleteNoteFile(notebookId, noteId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete note file',
      };
    }
  });
}

/** Register IPC handlers for plugin config persistence */
function registerPluginConfigHandlers(): void {
  ipcMain.handle('pluginConfig:get', (_event, pluginId: string, key: string) => {
    const row = db!
      .prepare('SELECT value FROM plugin_config WHERE plugin_id = ? AND key = ?')
      .get(pluginId, key) as { value: string } | undefined;
    return row ? JSON.parse(row.value) : undefined;
  });

  ipcMain.handle('pluginConfig:set', (_event, pluginId: string, key: string, value: unknown) => {
    db!
      .prepare('INSERT OR REPLACE INTO plugin_config (plugin_id, key, value) VALUES (?, ?, ?)')
      .run(pluginId, key, JSON.stringify(value));
  });

  ipcMain.handle('pluginConfig:getAll', (_event, pluginId: string) => {
    const rows = db!
      .prepare('SELECT key, value FROM plugin_config WHERE plugin_id = ?')
      .all(pluginId) as Array<{ key: string; value: string }>;
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[row.key] = JSON.parse(row.value);
    }
    return result;
  });

  ipcMain.handle('pluginConfig:clear', (_event, pluginId: string) => {
    db!.prepare('DELETE FROM plugin_config WHERE plugin_id = ?').run(pluginId);
  });
}

/** Register IPC handlers for plugin discovery */
function registerPluginDiscoveryHandlers(): void {
  if (!dataPaths || !db) {
    throw new Error('Data paths or database not initialized');
  }

  const paths = dataPaths;
  const database = db;

  // Scan filesystem for plugins
  ipcMain.handle('plugins:scan', async () => {
    return scanPlugins(paths.plugins);
  });

  // Check if a plugin is enabled (default: true if no row exists)
  ipcMain.handle('plugins:isEnabled', (_event, pluginId: string) => {
    const row = database
      .prepare('SELECT enabled FROM plugin_registry WHERE plugin_id = ?')
      .get(pluginId) as { enabled: number } | undefined;
    return row ? row.enabled === 1 : true;
  });

  // Set plugin enabled/disabled state
  ipcMain.handle('plugins:setEnabled', (_event, pluginId: string, enabled: boolean) => {
    database
      .prepare(
        'INSERT INTO plugin_registry (plugin_id, enabled) VALUES (?, ?) ON CONFLICT(plugin_id) DO UPDATE SET enabled = ?'
      )
      .run(pluginId, enabled ? 1 : 0, enabled ? 1 : 0);
  });

  // List all plugin registry state
  ipcMain.handle('plugins:listState', () => {
    const rows = database.prepare('SELECT plugin_id, enabled FROM plugin_registry').all() as Array<{
      plugin_id: string;
      enabled: number;
    }>;
    return rows.map(row => ({
      pluginId: row.plugin_id,
      enabled: row.enabled === 1,
    }));
  });

  // Read init.js user script (returns null if not found)
  ipcMain.handle('plugins:readInitScript', async () => {
    const initPath = join(paths.root, 'init.js');
    try {
      const code = await readFile(initPath, 'utf-8');
      return code;
    } catch {
      return null;
    }
  });

  // Install plugin from archive (.tar.gz or .zip)
  ipcMain.handle('plugins:install', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Install Plugin',
      properties: ['openFile'],
      filters: [{ name: 'Plugin Archive', extensions: ['tar.gz', 'tgz', 'zip'] }],
      buttonLabel: 'Install',
    });

    if (canceled || !filePaths[0]) {
      return { success: false, error: 'Cancelled' };
    }

    const archivePath = filePaths[0];
    const fileName = basename(archivePath).toLowerCase();

    try {
      // Ensure plugins dir exists
      await mkdir(paths.plugins, { recursive: true });

      // Extract to a temp dir first, then move validated plugin folder
      const tmpDir = join(paths.plugins, `__installing_${Date.now()}`);
      await mkdir(tmpDir, { recursive: true });

      await new Promise<void>((resolve, reject) => {
        let cmd: string;
        if (fileName.endsWith('.zip')) {
          if (process.platform === 'win32') {
            cmd = `powershell -command "Expand-Archive -Force '${archivePath}' '${tmpDir}'"`;
          } else {
            cmd = `unzip -o "${archivePath}" -d "${tmpDir}"`;
          }
        } else {
          cmd = `tar -xzf "${archivePath}" -C "${tmpDir}"`;
        }
        exec(cmd, error => {
          if (error) reject(error);
          else resolve();
        });
      });

      // Find the manifest.json — could be at root or one level deep
      const entries = await readdir(tmpDir);
      let pluginSourceDir = tmpDir;

      // If there's a single subdirectory, use that as the plugin root
      if (entries.length === 1 && entries[0]) {
        const candidatePath = join(tmpDir, entries[0]);
        const candidateStat = await stat(candidatePath);
        if (candidateStat.isDirectory()) {
          pluginSourceDir = candidatePath;
        }
      }

      // Validate: must have manifest.json
      const manifestPath = join(pluginSourceDir, 'manifest.json');
      if (!existsSync(manifestPath)) {
        await rm(tmpDir, { recursive: true, force: true });
        return { success: false, error: 'No manifest.json found in archive' };
      }

      const manifestRaw = await readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);
      if (!manifest.id || !manifest.name) {
        await rm(tmpDir, { recursive: true, force: true });
        return { success: false, error: 'Invalid manifest: missing id or name' };
      }

      // Move to final destination
      const destDir = join(paths.plugins, manifest.id);
      if (existsSync(destDir)) {
        await rm(destDir, { recursive: true, force: true });
      }

      await rename(pluginSourceDir, destDir);

      // Clean up temp dir (in case pluginSourceDir was a subdirectory)
      if (pluginSourceDir !== tmpDir && existsSync(tmpDir)) {
        await rm(tmpDir, { recursive: true, force: true });
      }

      return { success: true, pluginId: manifest.id, pluginName: manifest.name };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Uninstall plugin (remove its directory)
  ipcMain.handle('plugins:uninstall', async (_event, pluginId: string) => {
    // Safety: only allow removing from the plugins directory, prevent path traversal
    const safeName = pluginId.replace(/[^a-z0-9-]/g, '');
    const pluginDir = join(paths.plugins, safeName);
    const normalizedDir = normalize(pluginDir);

    if (!normalizedDir.startsWith(normalize(paths.plugins))) {
      return { success: false, error: 'Invalid plugin ID' };
    }

    if (!existsSync(pluginDir)) {
      return { success: false, error: 'Plugin not found' };
    }

    try {
      await rm(pluginDir, { recursive: true, force: true });
      // Clean up registry entry
      database.prepare('DELETE FROM plugin_registry WHERE plugin_id = ?').run(pluginId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Request plugin reload: broadcast to all windows except sender
  ipcMain.on('plugins:requestReload', event => {
    const senderWebContents = event.sender;
    BrowserWindow.getAllWindows().forEach(win => {
      if (win.webContents !== senderWebContents && !win.isDestroyed()) {
        win.webContents.send('plugins:reload');
      }
    });
  });
}

/** Register IPC handler for AI API proxy (avoids CORS in renderer) */
function registerAiHandlers(): void {
  ipcMain.handle(
    'ai:query',
    async (
      _event,
      options: {
        apiKey: string;
        model: string;
        system: string;
        messages: Array<{ role: string; content: string }>;
        maxTokens?: number;
      }
    ) => {
      const { apiKey, model, system, messages, maxTokens = 2048 } = options;

      try {
        const response = await net.fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            system,
            messages,
          }),
        });

        if (!response.ok) {
          const body = await response.text();
          return { ok: false, error: `API error ${response.status}: ${body}` };
        }

        const data = (await response.json()) as {
          content: Array<{ type: string; text?: string }>;
        };

        const textBlock = data.content.find((b: { type: string }) => b.type === 'text');
        return { ok: true, content: textBlock?.text ?? '' };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );
}

/** Initialize auto-updater */
function initAutoUpdater(): void {
  const updateLog = loggers.updater();

  // Only check for updates in production
  if (process.env.NODE_ENV === 'development') {
    updateLog.debug('Skipping auto-updater in development');
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    updateLog.info('Checking for updates...');
  });

  autoUpdater.on('update-available', info => {
    updateLog.info({ version: info.version }, 'Update available');
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('updates:available', { version: info.version });
      }
    });
  });

  autoUpdater.on('update-not-available', () => {
    updateLog.info('No updates available');
  });

  autoUpdater.on('download-progress', progress => {
    updateLog.debug({ percent: progress.percent.toFixed(1) }, 'Download progress');
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('updates:download-progress', {
          percent: progress.percent,
          bytesPerSecond: progress.bytesPerSecond,
          transferred: progress.transferred,
          total: progress.total,
        });
      }
    });
  });

  autoUpdater.on('update-downloaded', info => {
    updateLog.info({ version: info.version }, 'Update downloaded');
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('updates:download-complete', { version: info.version });
      }
    });
  });

  autoUpdater.on('error', err => {
    updateLog.error({ error: err.message }, 'Updater error');
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('updates:error', { message: err.message });
      }
    });
  });

  // Check for updates after a short delay
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 3000);
}

/**
 * asset:// protocol
 *
 * Invariant:
 * - Renderer NEVER accesses filesystem paths directly
 * - All local assets are resolved via asset:// URLs
 *
 * Rationale:
 * - Avoids file:// which is blocked in dev (http://localhost)
 * - Same behavior in dev and production
 * - Enables secure embeds (images, video, pdf)
 */
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'asset',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
  {
    scheme: 'readied',
    privileges: {
      secure: true,
      standard: true,
    },
  },
]);

// App lifecycle
app
  .whenReady()
  .then(() => {
    // Initialize data paths first (creates directories)
    dataPaths = initDataPaths();

    // Register asset:// protocol handler (modern protocol.handle API)
    protocol.handle('asset', request => {
      // asset://local/noteId/filename → assets/noteId/filename
      // Strip protocol and host (local/)
      let urlPath = decodeURIComponent(new URL(request.url).pathname);
      if (urlPath.startsWith('/')) {
        urlPath = urlPath.slice(1);
      }

      // Sanitize: prevent path traversal attacks
      const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');

      const filePath = join(dataPaths!.assets, safePath);

      if (!existsSync(filePath)) {
        return new Response('Not Found', { status: 404 });
      }

      return net.fetch(`file://${filePath}`);
    });

    // Initialize logger (must be after dataPaths)
    const log = initLogger({
      logsDir: dataPaths.logs,
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      isDevelopment: process.env.NODE_ENV === 'development',
    });
    log.info({ dataDir: dataPaths.root }, 'Application starting');

    // Initialize database and handlers
    initDatabase();
    registerIpcHandlers();
    registerNotebookHandlers();
    registerGitHandlers(); // Git operations for git-backed notebooks
    registerPluginConfigHandlers();
    registerPluginDiscoveryHandlers();
    registerAiHandlers();

    // Start plugin hot-reload watcher in dev mode
    if (process.env.NODE_ENV === 'development' && dataPaths) {
      startPluginWatcher(dataPaths.plugins);
    }

    registerDataHandlers();

    // Initialize license storage
    licenseStorage = new FileLicenseStorage(dataPaths.root);
    registerLogHandlers();
    registerUpdateHandlers();

    // App version
    ipcMain.handle('app:version', () => app.getVersion());

    // Settings sync: broadcast to all windows except sender
    ipcMain.on('settings:changed', (event, settings) => {
      const senderWebContents = event.sender;
      BrowserWindow.getAllWindows().forEach(win => {
        if (win.webContents !== senderWebContents && !win.isDestroyed()) {
          win.webContents.send('settings:sync', settings);
        }
      });
    });

    // Initialize auth and sync services
    const initAuthSync = async () => {
      if (!dataPaths) {
        log.error('Cannot initialize auth/sync services: dataPaths not initialized');
        return;
      }

      if (!noteRepository) {
        log.error('Cannot initialize sync service: noteRepository not initialized');
        return;
      }

      if (!notebookRepository) {
        log.error('Cannot initialize sync service: notebookRepository not initialized');
        return;
      }

      try {
        tokenStorage = new TokenStorage(dataPaths.root);
        deviceInfo = await getOrCreateDeviceInfo(dataPaths.root);

        const apiBaseUrl = process.env.READIED_API_URL || 'https://api.readied.app';
        apiClient = new ApiClient(apiBaseUrl, tokenStorage, deviceInfo);

        encryptionService = new EncryptionService(dataPaths.root);
        await encryptionService.initialize();

        syncService = new SyncService(
          apiClient,
          encryptionService,
          noteRepository,
          notebookRepository
        );

        // Register license handlers with dependencies
        if (licenseStorage) {
          registerLicenseHandlers({
            licenseStorage,
            apiClient,
          });
        }

        registerAuthSyncHandlers();
        registerShareHandlers({ apiClient });
        log.info('Auth and sync services initialized');
      } catch (error) {
        log.error(
          { error: error instanceof Error ? error.message : String(error) },
          'Failed to initialize auth/sync services'
        );
      }
    };

    initAuthSync();

    log.info('All IPC handlers registered');

    // Install React DevTools in development
    if (process.env.NODE_ENV === 'development') {
      installExtension(REACT_DEVELOPER_TOOLS)
        .then(name => log.info({ extension: name }, 'DevTools extension installed'))
        .catch(err => log.warn({ error: err.message }, 'Failed to install DevTools extension'));
    }

    // Create window and start auto-updater
    createWindow();
    initAutoUpdater();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  })
  .catch(err => {
    console.error('Failed to initialize app:', err);
    app.quit();
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopPluginWatcher();
  if (db) {
    db.close();
    getLogger().info('Database closed');
  }
});

// Deep link handler for readied:// protocol (macOS)
app.on('open-url', (event, url) => {
  event.preventDefault();
  const log = getLogger();
  log.info({ url }, 'Deep link received');

  try {
    const urlObj = new URL(url);

    // Handle auth verification: readied://auth/verify?token=xxx
    if (urlObj.hostname === 'auth' && urlObj.pathname === '/verify') {
      const token = urlObj.searchParams.get('token');
      if (token) {
        log.info('Auth verification token received via deep link');

        // Send token to renderer process
        const mainWin = BrowserWindow.getAllWindows().find(win => !win.isDestroyed());
        if (mainWin) {
          mainWin.webContents.send('auth:verify-token', token);
          mainWin.show();
          mainWin.focus();
        }
      } else {
        log.warn('Deep link missing token parameter');
      }
    } else {
      log.warn(
        { hostname: urlObj.hostname, pathname: urlObj.pathname },
        'Unknown deep link format'
      );
    }
  } catch (error) {
    log.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to parse deep link URL'
    );
  }
});

// Register as default protocol client (Windows/Linux)
if (process.defaultApp) {
  if (process.argv.length >= 2 && process.argv[1]) {
    app.setAsDefaultProtocolClient('readied', process.execPath, [process.argv[1]]);
  }
} else {
  app.setAsDefaultProtocolClient('readied');
}
