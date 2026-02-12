/**
 * SQLite Database Adapter
 *
 * Wraps better-sqlite3 for type-safe database operations.
 * Implements DatabaseAdapter from @readied/storage-core.
 */

import type { Database as DatabaseType, Statement } from 'better-sqlite3';
import type { DatabaseAdapter, PreparedStatement, StatementResult } from '@readied/storage-core';

// Dynamic require for native module - this syntax prevents bundlers from
// statically analyzing and bundling the native module. At runtime, this
// evaluates to a regular require('better-sqlite3') call.

const Database = require('better-sqlite3') as typeof import('better-sqlite3');

export interface DatabaseOptions {
  /** Path to the SQLite database file */
  path: string;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Create database if it doesn't exist */
  create?: boolean;
}

/**
 * Wraps a better-sqlite3 Statement to implement PreparedStatement interface.
 */
function wrapStatement<T>(stmt: Statement): PreparedStatement<T> {
  return {
    get(...params: unknown[]): T | undefined {
      return stmt.get(...params) as T | undefined;
    },
    all(...params: unknown[]): T[] {
      return stmt.all(...params) as T[];
    },
    run(...params: unknown[]): StatementResult {
      const result = stmt.run(...params);
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid,
      };
    },
  };
}

/** Database connection wrapper implementing DatabaseAdapter */
export class DatabaseConnection implements DatabaseAdapter {
  private db: DatabaseType;
  private readonly path: string;

  constructor(options: DatabaseOptions) {
    this.path = options.path;

    this.db = new Database(options.path, {
      // eslint-disable-next-line no-console
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
  prepare<T = unknown>(sql: string): PreparedStatement<T> {
    return wrapStatement<T>(this.db.prepare(sql));
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
