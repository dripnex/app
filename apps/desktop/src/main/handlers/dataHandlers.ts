/**
 * Data Management IPC Handlers
 *
 * Handles backup, export, import, and data path operations.
 */

import { join } from 'path';
import { writeFile } from 'fs/promises';
import { copyFileSync, existsSync, unlinkSync } from 'fs';
import { ipcMain, dialog, shell, app } from 'electron';
import { z } from 'zod';
import {
  createBackup,
  listBackups,
  restoreBackup,
  exportNotes,
  importNotes,
  detectImportType,
  type DataPaths,
} from '@dripnex/storage-core';
import { createDatabase, allMigrations } from '@dripnex/storage-sqlite';
import { runMigrations } from '@dripnex/storage-core';
import { createNoteOperation } from '@dripnex/core';
import { defineIpcHandler } from '../ipc/registry.js';
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

  defineIpcHandler({
    channel: 'data:backup',
    args: z.tuple([]),
    handler: () =>
      createBackup({
        backupDir: paths.backups,
        databasePath: paths.database,
      }),
  });

  defineIpcHandler({
    channel: 'data:backups:list',
    args: z.tuple([]),
    handler: () => listBackups(paths.backups),
  });

  // Restore uses ipcMain.handle raw because the integrity-check rollback
  // path is non-trivial state management — see PR #271 for the rationale.
  // Validation: backupPath must be a non-empty string. We don't constrain
  // it further (it comes from a native dialog), but the rollback logic
  // is what guarantees safety, not the schema.
  ipcMain.handle('data:backup:restore', async (_event, backupPath: string) => {
    const currentDb = getDb();
    if (currentDb) {
      currentDb.close();
    }

    // Copies backup over the live db file and writes a `.pre-restore` safety
    // copy of the previous live db (used by the rollback path below).
    const result = restoreBackup(backupPath, paths.database);
    if (!result.success) {
      // restoreBackup never touched the live db, just reopen it.
      setDb(createDatabase(paths.database));
      return result;
    }

    const safetyPath = paths.database + '.pre-restore';
    const rollback = (reason: string): typeof result => {
      if (existsSync(safetyPath)) {
        copyFileSync(safetyPath, paths.database);
      }
      setDb(createDatabase(paths.database));
      return { success: false, error: reason };
    };

    let newDb: ReturnType<typeof createDatabase>;
    try {
      newDb = createDatabase(paths.database);
    } catch (err) {
      return rollback(
        `Could not open restored database: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // PRAGMA integrity_check returns a single row `{ integrity_check: 'ok' }`
    // on a healthy database, or one or more rows describing the corruption.
    // We refuse to swap to a corrupt restore and roll back to the safety copy.
    try {
      const row = newDb.prepare<{ integrity_check: string }>('PRAGMA integrity_check').get();
      if (row?.integrity_check !== 'ok') {
        newDb.close();
        return rollback(
          `Backup failed integrity check (${row?.integrity_check ?? 'unknown error'}). Previous database has been restored.`
        );
      }
    } catch (err) {
      newDb.close();
      return rollback(
        `Backup integrity check threw: ${err instanceof Error ? err.message : String(err)}. Previous database has been restored.`
      );
    }

    // Backup is intact — apply migrations to bring older schemas current.
    try {
      runMigrations(newDb, allMigrations);
    } catch (err) {
      newDb.close();
      return rollback(
        `Migrations failed on restored database: ${err instanceof Error ? err.message : String(err)}. Previous database has been restored.`
      );
    }

    setDb(newDb);

    // Restore succeeded — discard the safety copy.
    if (existsSync(safetyPath)) {
      try {
        unlinkSync(safetyPath);
      } catch {
        // best-effort cleanup; not fatal
      }
    }

    return result;
  });

  defineIpcHandler({
    channel: 'data:export',
    args: z.tuple([]),
    handler: async () => {
      // Show save dialog
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Export Notes',
        defaultPath: join(app.getPath('documents'), 'dripnex-export'),
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
        shell.showItemInFolder(filePath);
      }

      return result;
    },
  });

  defineIpcHandler({
    channel: 'data:exportNote',
    args: z.tuple([z.string().max(1024 * 1024), z.string().max(512)]),
    handler: async (content, suggestedName) => {
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
    },
  });

  defineIpcHandler({
    channel: 'data:import',
    args: z.tuple([]),
    handler: async () => {
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
    },
  });

  defineIpcHandler({
    channel: 'data:paths',
    args: z.tuple([]),
    handler: () => ({
      root: paths.root,
      database: paths.database,
      backups: paths.backups,
      logs: paths.logs,
    }),
  });

  defineIpcHandler({
    channel: 'data:openFolder',
    args: z.tuple([]),
    handler: () => {
      void shell.openPath(paths.root);
      return { success: true };
    },
  });
}
