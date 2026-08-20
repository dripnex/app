/**
 * @dripnex/storage-sqlite
 *
 * SQLite storage adapter for Dripnex.
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
  noteFilterSql,
  type BacklinkInfo,
  type SyncHistoryEntry,
  type NoteCountSummary,
  type NoteCountScoped,
} from './repositories/SQLiteNoteRepository.js';
export { SQLiteNotebookRepository } from './repositories/SQLiteNotebookRepository.js';
export { SQLiteChunkRepository } from './repositories/ChunkRepository.js';
export { hashChunkContent, chunkRowId } from './repositories/chunkHash.js';
export { indexNoteChunks } from './repositories/indexNoteChunks.js';

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
  ftsIncludeDeleted,
  embeddings,
} from './migrations/index.js';
