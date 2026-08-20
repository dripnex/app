/**
 * @dripnex/storage-core
 *
 * Storage interfaces and utilities for Dripnex.
 * This package contains no native dependencies and can be used in any environment.
 */

// Interfaces
export type {
  DatabaseAdapter,
  PreparedStatement,
  StatementResult,
} from './interfaces/DatabaseAdapter.js';

export type { Migration, MigrationRecord } from './interfaces/Migration.js';

export type { ExtendedNoteRepository } from './interfaces/ExtendedNoteRepository.js';
export type { ChunkRepository, ChunkWrite, StoredChunk } from './interfaces/ChunkRepository.js';

// Types
export type { ArchivedFilter } from './types/ArchivedFilter.js';
export type { ListNotesOptions } from './types/ListNotesOptions.js';
export type { NoteSnapshot } from './types/NoteSnapshot.js';
export type {
  NoteCountSummary,
  NoteCountScoped,
  BacklinkInfo,
  OutgoingLinkInfo,
  GraphNodeInfo,
  GraphData,
} from './types/NoteQuery.js';

// Migrations
export { runMigrations, getPendingMigrations, getCurrentVersion } from './migrations/runner.js';

// Repositories
export { InMemoryNoteRepository } from './repositories/InMemoryNoteRepository.js';

// Data management (directories, backup, export, import)
export * from './data/index.js';
