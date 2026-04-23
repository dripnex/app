/**
 * Data Management IPC Handlers
 *
 * Handles backup, export, import, and data path operations.
 */

import { join } from 'path';
import { writeFile } from 'fs/promises';
import { ipcMain, dialog, shell, app } from 'electron';
import {
  createBackup,
  listBackups,
  restoreBackup,
  exportNotes,
  importNotes,
  detectImportType,
  type DataPaths,
} from '@readied/storage-core';
import { createDatabase, allMigrations } from '@readied/storage-sqlite';
import { runMigrations } from '@readied/storage-core';
import { createNoteOperation } from '@readied/core';
import type { SQLiteNoteRepository, Database } from './types.js';

export interface DataHandlerDeps {
  dataPaths: DataPaths;
  noteRepository: SQLiteNoteRepository;
  /** Returns the current db reference (may change after restore) */
  getDb: () => Database;
  /** Called after restore to update the db reference */
  setDb: (newDb: Database) => void;
}

export function registerDataHandlers(deps: DataHandlerDeps): void {
  const { dataPaths: paths, noteRepository: repo, getDb, setDb } = deps;

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
    const currentDb = getDb();
    if (currentDb) {
      currentDb.close();
    }

    const result = restoreBackup(backupPath, paths.database);

    // Reconnect to database
    const newDb = createDatabase(paths.database);
    runMigrations(newDb, allMigrations);
    setDb(newDb);

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

  // Export single note to file
  ipcMain.handle(
    'data:exportNote',
    async (_event: Electron.IpcMainInvokeEvent, content: string, suggestedName: string) => {
      let safeName =
        suggestedName
          .normalize('NFC')
          // eslint-disable-next-line no-control-regex
          .replace(/[/\\:*?"<>|\x00-\x1f.]/g, '')
          .substring(0, 80)
          .trim() || 'note';
      const WINDOWS_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;
      if (WINDOWS_RESERVED.test(safeName)) safeName = `_${safeName}`;
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Export Note',
        defaultPath: join(app.getPath('documents'), `${safeName}.md`),
        buttonLabel: 'Export',
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });

      if (canceled || !filePath) {
        return { success: false, error: 'Export cancelled' };
      }

      try {
        await writeFile(filePath, content, 'utf-8');
        return { success: true, path: filePath };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to write file',
        };
      }
    }
  );

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
    void shell.openPath(paths.root);
    return { success: true };
  });
}
