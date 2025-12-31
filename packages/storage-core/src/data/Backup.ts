/**
 * Backup System
 *
 * Automatic and manual database backups.
 * Keeps rotating backups to prevent disk bloat.
 */

import { copyFileSync, existsSync, readdirSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import { generateBackupFilename, generateMigrationBackupFilename } from './DataPaths.js';

export interface BackupOptions {
  /** Maximum number of backups to keep */
  maxBackups?: number;
  /** Backup directory path */
  backupDir: string;
  /** Database file path */
  databasePath: string;
}

export interface BackupResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface BackupInfo {
  filename: string;
  path: string;
  createdAt: Date;
  sizeBytes: number;
}

const DEFAULT_MAX_BACKUPS = 5;

/**
 * Create a backup of the database.
 */
export function createBackup(options: BackupOptions): BackupResult {
  const { backupDir, databasePath, maxBackups = DEFAULT_MAX_BACKUPS } = options;

  if (!existsSync(databasePath)) {
    return { success: false, error: 'Database file does not exist' };
  }

  try {
    const filename = generateBackupFilename();
    const backupPath = join(backupDir, filename);

    // Copy database file
    copyFileSync(databasePath, backupPath);

    // Cleanup old backups
    cleanupOldBackups(backupDir, maxBackups);

    return { success: true, path: backupPath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create a pre-migration backup.
 */
export function createMigrationBackup(
  options: BackupOptions & { fromVersion: number; toVersion: number }
): BackupResult {
  const { backupDir, databasePath, fromVersion, toVersion } = options;

  if (!existsSync(databasePath)) {
    return { success: false, error: 'Database file does not exist' };
  }

  try {
    const filename = generateMigrationBackupFilename(fromVersion, toVersion);
    const backupPath = join(backupDir, filename);

    // Copy database file
    copyFileSync(databasePath, backupPath);

    return { success: true, path: backupPath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * List all backups sorted by date (newest first).
 */
export function listBackups(backupDir: string): BackupInfo[] {
  if (!existsSync(backupDir)) {
    return [];
  }

  const files = readdirSync(backupDir).filter(f => f.endsWith('.db'));

  return files
    .map(filename => {
      const path = join(backupDir, filename);
      const stats = statSync(path);
      return {
        filename,
        path,
        createdAt: stats.mtime,
        sizeBytes: stats.size,
      };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Restore database from a backup.
 */
export function restoreBackup(backupPath: string, databasePath: string): BackupResult {
  if (!existsSync(backupPath)) {
    return { success: false, error: 'Backup file does not exist' };
  }

  try {
    // Create a safety backup of current database before restoring
    if (existsSync(databasePath)) {
      const safetyBackup = databasePath + '.pre-restore';
      copyFileSync(databasePath, safetyBackup);
    }

    // Restore from backup
    copyFileSync(backupPath, databasePath);

    return { success: true, path: databasePath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete old backups, keeping only the newest ones.
 */
function cleanupOldBackups(backupDir: string, maxBackups: number): void {
  const backups = listBackups(backupDir);

  if (backups.length <= maxBackups) {
    return;
  }

  // Delete oldest backups
  const toDelete = backups.slice(maxBackups);
  for (const backup of toDelete) {
    try {
      unlinkSync(backup.path);
    } catch {
      // Ignore deletion errors
    }
  }
}

/**
 * Get total size of all backups in bytes.
 */
export function getBackupsSize(backupDir: string): number {
  const backups = listBackups(backupDir);
  return backups.reduce((total, b) => total + b.sizeBytes, 0);
}

/**
 * Delete a specific backup.
 */
export function deleteBackup(backupPath: string): BackupResult {
  if (!existsSync(backupPath)) {
    return { success: false, error: 'Backup file does not exist' };
  }

  try {
    unlinkSync(backupPath);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
