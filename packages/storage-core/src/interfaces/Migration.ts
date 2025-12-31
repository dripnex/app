/**
 * Migration Interface
 *
 * Defines the structure for database migrations
 */

/** A single migration */
export interface Migration {
  /** Unique version identifier (use timestamp format: 20241231120000) */
  version: number;
  /** Human-readable name */
  name: string;
  /** SQL to execute (forward only, no rollback) */
  up: string;
}

/** Migration status record stored in database */
export interface MigrationRecord {
  version: number;
  name: string;
  applied_at: string;
}
