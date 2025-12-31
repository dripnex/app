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
import { createDatabase, allMigrations, SQLiteNoteRepository } from '@readied/storage-sqlite';
import {
  createNoteOperation,
  updateNoteOperation,
  deleteNoteOperation,
  getNoteOperation,
  archiveNoteOperation,
  restoreNoteOperation,
  duplicateNoteOperation,
} from '@readied/core';
import { createNoteId } from '@readied/core';
import {
  parseLicenseFile,
  computeLicenseState,
  startTrial,
  needsTrialStart,
  createStoredLicenseData,
  type LicenseStorage,
  type StoredTrialData,
  type StoredLicenseData,
  type AppLicenseState,
} from '@readied/licensing';
import { initLogger, createChildLogger, type LogLevel } from './logger';

// Database and repository (initialized on app ready)
let db: ReturnType<typeof createDatabase> | null = null;
let noteRepository: SQLiteNoteRepository | null = null;
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

  console.log(`[Main] Database path: ${dataPaths.database}`);

  db = createDatabase(dataPaths.database);
  runMigrations(db, allMigrations);
  noteRepository = new SQLiteNoteRepository(db);

  console.log('[Main] Database initialized');
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
  ipcMain.handle('license:getState', async (): Promise<AppLicenseState> => {
    let trialData = await storage.readTrialData();
    const licenseData = await storage.readLicenseData();

    // Auto-start trial if needed
    if (needsTrialStart(trialData, licenseData)) {
      trialData = startTrial();
      await storage.writeTrialData(trialData);
      console.log('[Main] Trial started automatically');
    }

    return computeLicenseState(trialData, licenseData);
  });

  // Activate license from content
  ipcMain.handle(
    'license:activate',
    async (_event, content: string): Promise<{ success: boolean; error?: string }> => {
      const result = await parseLicenseFile(content);

      if (!result.valid || !result.license) {
        return { success: false, error: result.error ?? 'Invalid license' };
      }

      const storedData = createStoredLicenseData(result.license);
      await storage.writeLicenseData(storedData);

      console.log('[Main] License activated:', result.license.licenseId);
      return { success: true };
    }
  );

  // Import license file via dialog
  ipcMain.handle('license:importFile', async (): Promise<{ success: boolean; error?: string }> => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Import License',
      filters: [{ name: 'License Files', extensions: ['json'] }],
      properties: ['openFile'],
      buttonLabel: 'Import',
    });

    if (canceled || !filePaths[0]) {
      return { success: false, error: 'Cancelled' };
    }

    try {
      const content = await readFile(filePaths[0], 'utf-8');
      const result = await parseLicenseFile(content);

      if (!result.valid || !result.license) {
        return { success: false, error: result.error ?? 'Invalid license' };
      }

      const storedData = createStoredLicenseData(result.license);
      await storage.writeLicenseData(storedData);

      console.log('[Main] License imported:', result.license.licenseId);
      return { success: true };
    } catch {
      return { success: false, error: 'Failed to read license file' };
    }
  });

  // Deactivate license (for debug/testing)
  ipcMain.handle('license:deactivate', async (): Promise<{ success: boolean }> => {
    await storage.removeLicenseData();
    console.log('[Main] License deactivated');
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
  // Only check for updates in production
  if (process.env.NODE_ENV === 'development') {
    console.log('[Main] Skipping auto-updater in development');
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Checking for updates...');
  });

  autoUpdater.on('update-available', info => {
    console.log('[Updater] Update available:', info.version);
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
    console.log('[Updater] No updates available');
  });

  autoUpdater.on('download-progress', progress => {
    console.log(`[Updater] Download progress: ${progress.percent.toFixed(1)}%`);
  });

  autoUpdater.on('update-downloaded', info => {
    console.log('[Updater] Update downloaded:', info.version);
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
    console.error('[Updater] Error:', err);
  });

  // Check for updates after a short delay
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 3000);
}

// App lifecycle
app.whenReady().then(() => {
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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (db) {
    db.close();
    console.log('[Main] Database closed');
  }
});
