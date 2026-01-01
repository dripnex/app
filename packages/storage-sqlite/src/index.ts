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
export { SQLiteNoteRepository } from './repositories/SQLiteNoteRepository.js';
export { SQLiteNotebookRepository } from './repositories/SQLiteNotebookRepository.js';

// Migrations
export { allMigrations, initialSchema, addArchivedAt, addNotebooks } from './migrations/index.js';
