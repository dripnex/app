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

// Migrations
export { allMigrations, initialSchema, addArchivedAt } from './migrations/index.js';
