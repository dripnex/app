/**
 * Data Management Module
 *
 * Handles data directories, backup, export, and import.
 */

// Data paths
export {
  type DataPaths,
  createDataPaths,
  ensureDirectory,
  generateBackupFilename,
  generateMigrationBackupFilename,
} from './DataPaths.js';

// Backup system
export {
  type BackupOptions,
  type BackupResult,
  type BackupInfo,
  createBackup,
  createMigrationBackup,
  listBackups,
  restoreBackup,
  getBackupsSize,
  deleteBackup,
} from './Backup.js';

// Export system
export {
  type ExportManifest,
  type ExportMetadata,
  type ExportNoteMetadata,
  type ExportOptions,
  type ExportResult,
  exportNotes,
  validateExportDir,
  readExportManifest,
  readExportMetadata,
} from './Export.js';

// Import system
export {
  type ImportedNote,
  type ImportResult,
  type ImportOptions,
  detectImportType,
  importNotes,
} from './Import.js';
