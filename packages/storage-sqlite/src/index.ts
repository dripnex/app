/**
 * @readied/storage-sqlite
 *
 * SQLite storage adapter for Readied.
 * This package contains the native better-sqlite3 implementation.
 */

// Database
export {
  DatabaseConnection,
  createDatabase,
  createInMemoryDatabase,
  type DatabaseOptions,
} from './database.js';

// Repositories
export {
  SQLiteNoteRepository,
  type BacklinkInfo,
  type SyncHistoryEntry,
} from './repositories/SQLiteNoteRepository.js';
export { SQLiteNotebookRepository } from './repositories/SQLiteNotebookRepository.js';

// Migrations
export {
  allMigrations,
  initialSchema,
  addArchivedAt,
  addNotebooks,
  addNoteFields,
  addManualTags,
  addTagColors,
  addLinks,
} from './migrations/index.js';
