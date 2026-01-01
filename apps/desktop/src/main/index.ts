/**
 * Electron Main Process
 *
 * Initializes the app, database, and IPC handlers.
 */

import { join } from 'path';
import { readFile, writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
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
  deleteNoteOperation,
  getNoteOperation,
  archiveNoteOperation,
  restoreNoteOperation,
  duplicateNoteOperation,
  moveNoteToNotebook,
} from '@readied/core';
import {
  createNoteId,
  createNotebookId,
  createNotebook,
  renameNotebook,
  moveNotebook,
  INBOX_NOTEBOOK_ID,
} from '@readied/core';
import {
  computeLicenseState,
  startTrial,
  canStartTrial,
  type LicenseStorage,
  type StoredTrialData,
  type StoredLicenseData,
  type AppLicenseState,
} from '@readied/licensing';
import { initLogger, createChildLogger, loggers, getLogger, type LogLevel } from './logger';

// Database and repository (initialized on app ready)
let db: ReturnType<typeof createDatabase> | null = null;
let noteRepository: SQLiteNoteRepository | null = null;
let notebookRepository: SQLiteNotebookRepository | null = null;
let dataPaths: DataPaths | null = null;
let licenseStorage: FileLicenseStorage | null = null;

/** File-based license storage implementation */
class FileLicenseStorage implements LicenseStorage {
  private licensePath: string;
  private trialPath: string;

  constructor(dataDir: string) {
    this.licensePath = join(dataDir, 'license.json');
    this.trialPath = join(dataDir, 'trial.json');
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

  dbLog.info('Database initialized');
}

/** Create the main window */
function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0a0b0d',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for better-sqlite3
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  // Load renderer
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

/** Register IPC handlers for notes CRUD */
function registerIpcHandlers(): void {
  if (!noteRepository) {
    throw new Error('Note repository not initialized');
  }

  const repo = noteRepository;

  // Create note
  ipcMain.handle('notes:create', async (_event, input: { content: string; id?: string }) => {
    return createNoteOperation(input, repo);
  });

  // Get note
  ipcMain.handle('notes:get', async (_event, id: string) => {
    const noteId = createNoteId(id);
    return getNoteOperation({ id: noteId }, repo);
  });

  // Update note
  ipcMain.handle('notes:update', async (_event, input: { id: string; content: string }) => {
    const noteId = createNoteId(input.id);
    return updateNoteOperation({ id: noteId, content: input.content }, repo);
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
      data: {
        id: movedNote.id,
        notebookId: movedNote.notebookId,
        content: movedNote.content,
        title: movedNote.metadata.title,
        createdAt: movedNote.metadata.createdAt,
        updatedAt: movedNote.metadata.updatedAt,
        tags: [...movedNote.metadata.tags],
        wordCount: movedNote.metadata.wordCount,
        archivedAt: movedNote.metadata.archivedAt,
        isArchived: movedNote.metadata.archivedAt !== null,
      },
    };
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
      // Return as snapshots (serialize for IPC)
      return notes.map(note => ({
        id: note.id,
        notebookId: note.notebookId,
        content: note.content,
        title: note.metadata.title,
        createdAt: note.metadata.createdAt,
        updatedAt: note.metadata.updatedAt,
        tags: [...note.metadata.tags],
        wordCount: note.metadata.wordCount,
        archivedAt: note.metadata.archivedAt,
        isArchived: note.metadata.archivedAt !== null,
      }));
    }
  );

  // Search notes
  ipcMain.handle('notes:search', async (_event, query: string, limit?: number) => {
    const notes = await repo.search(query, limit);
    return notes.map(note => ({
      id: note.id,
      notebookId: note.notebookId,
      content: note.content,
      title: note.metadata.title,
      createdAt: note.metadata.createdAt,
      updatedAt: note.metadata.updatedAt,
      tags: [...note.metadata.tags],
      wordCount: note.metadata.wordCount,
      archivedAt: note.metadata.archivedAt,
      isArchived: note.metadata.archivedAt !== null,
    }));
  });

  // Get all tags
  ipcMain.handle('notes:tags', async () => {
    return repo.getAllTags();
  });

  // Count notes
  ipcMain.handle('notes:count', async () => {
    const [active, archived] = await Promise.all([repo.count(false), repo.countArchived()]);
    return { active, archived, total: active + archived };
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
      title: note.metadata.title,
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

/** Register IPC handlers for licensing */
function registerLicenseHandlers(): void {
  if (!licenseStorage) {
    throw new Error('License storage not initialized');
  }

  const storage = licenseStorage;

  // Get current license state
  // In subscription model: trial data is local, subscription data comes from server (not implemented yet)
  ipcMain.handle('license:getState', async (): Promise<AppLicenseState> => {
    let trialData = await storage.readTrialData();

    // Auto-start trial if user hasn't started one yet
    // Note: In subscription model, canStartTrial checks if trial hasn't started and no active subscription
    if (canStartTrial(trialData, null)) {
      trialData = startTrial();
      await storage.writeTrialData(trialData);
      loggers.license().info('Trial started automatically');
    }

    // Compute state from trial data only (subscription verification not implemented yet)
    // Once subscription system is ready, we'll pass subscription data as second parameter
    return computeLicenseState(trialData, null);
  });

  // Start trial manually (if not auto-started)
  ipcMain.handle('license:startTrial', async (): Promise<{ success: boolean; error?: string }> => {
    const trialData = await storage.readTrialData();

    if (!canStartTrial(trialData, null)) {
      return { success: false, error: 'Trial already started or subscription active' };
    }

    const newTrialData = startTrial();
    await storage.writeTrialData(newTrialData);
    loggers.license().info('Trial started manually');
    return { success: true };
  });

  // Open subscription page (placeholder for future)
  ipcMain.handle('license:openSubscribe', async (): Promise<{ success: boolean }> => {
    // TODO: Open browser to subscription page when payment system is ready
    loggers.license().info('Subscription page requested (not implemented yet)');
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
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available.`,
        detail: 'Would you like to download it now?',
        buttons: ['Download', 'Later'],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.downloadUpdate();
        }
      });
  });

  autoUpdater.on('update-not-available', () => {
    updateLog.info('No updates available');
  });

  autoUpdater.on('download-progress', progress => {
    updateLog.debug({ percent: progress.percent.toFixed(1) }, 'Download progress');
  });

  autoUpdater.on('update-downloaded', info => {
    updateLog.info({ version: info.version }, 'Update downloaded');
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded. Restart to apply?',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  autoUpdater.on('error', err => {
    updateLog.error({ error: err.message }, 'Updater error');
  });

  // Check for updates after a short delay
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 3000);
}

// App lifecycle
app
  .whenReady()
  .then(() => {
    // Initialize data paths first (creates directories)
    dataPaths = initDataPaths();

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
    registerDataHandlers();

    // Initialize license storage and handlers
    licenseStorage = new FileLicenseStorage(dataPaths.root);
    registerLicenseHandlers();
    registerLogHandlers();
    log.info('All IPC handlers registered');

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
  if (db) {
    db.close();
    getLogger().info('Database closed');
  }
});
