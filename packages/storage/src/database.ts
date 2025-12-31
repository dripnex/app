/**
 * SQLite Database Adapter
 *
 * Wraps better-sqlite3 for type-safe database operations
 */

import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';

export interface DatabaseOptions {
  /** Path to the SQLite database file */
  path: string;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Create database if it doesn't exist */
  create?: boolean;
}

/** Database connection wrapper */
export class DatabaseConnection {
  private db: DatabaseType;
  private readonly path: string;

  constructor(options: DatabaseOptions) {
    this.path = options.path;

    this.db = new Database(options.path, {
      verbose: options.verbose ? console.log : undefined,
    });

    // Enable WAL mode for better performance
    this.db.pragma('journal_mode = WAL');

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
  }

  /** Get the underlying database instance */
  get instance(): DatabaseType {
    return this.db;
  }

  /** Get database file path */
  get filePath(): string {
    return this.path;
  }

  /** Execute a SQL statement */
  exec(sql: string): void {
    this.db.exec(sql);
  }

  /** Prepare a statement for execution */
  prepare<T = unknown>(sql: string): Database.Statement<T[]> {
    return this.db.prepare(sql);
  }

  /** Run a transaction */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  /** Close the database connection */
  close(): void {
    this.db.close();
  }

  /** Check if database is open */
  get isOpen(): boolean {
    return this.db.open;
  }
}

/** Create an in-memory database (useful for testing) */
export function createInMemoryDatabase(): DatabaseConnection {
  return new DatabaseConnection({ path: ':memory:' });
}

/** Create a file-based database */
export function createDatabase(path: string): DatabaseConnection {
  return new DatabaseConnection({ path });
}
