/**
 * DatabaseAdapter Interface
 *
 * Abstract interface for database operations.
 * Allows migration runner and other utilities to work with any SQL database.
 */

/** Statement result with changes info */
export interface StatementResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

/**
 * Prepared statement interface for parameterized queries.
 * Mirrors better-sqlite3's Statement API.
 */
export interface PreparedStatement<T = unknown> {
  /** Get first matching row */
  get(...params: unknown[]): T | undefined;
  /** Get all matching rows */
  all(...params: unknown[]): T[];
  /** Run statement (INSERT/UPDATE/DELETE) */
  run(...params: unknown[]): StatementResult;
}

/**
 * Abstract interface for database operations.
 * Implementations should wrap specific database drivers (e.g., better-sqlite3).
 */
export interface DatabaseAdapter {
  /** Execute raw SQL (for DDL/migrations) */
  exec(sql: string): void;

  /** Prepare a statement for parameterized queries */
  prepare<T = unknown>(sql: string): PreparedStatement<T>;

  /** Execute within a transaction */
  transaction<T>(fn: () => T): T;

  /** Close the database connection */
  close(): void;
}
