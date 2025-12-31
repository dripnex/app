/**
 * @readied/storage-core
 *
 * Storage interfaces and utilities for Readied.
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

// Types
export type { ArchivedFilter } from './types/ArchivedFilter.js';
export type { ListNotesOptions } from './types/ListNotesOptions.js';

// Migrations
export { runMigrations, getPendingMigrations, getCurrentVersion } from './migrations/runner.js';

// Repositories
export { InMemoryNoteRepository } from './repositories/InMemoryNoteRepository.js';
