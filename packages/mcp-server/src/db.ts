/**
 * Database connection for the MCP server.
 *
 * Opens the Readied SQLite database using better-sqlite3 (native).
 * The MCP server runs as a standalone Node.js process, so native
 * modules work without Electron conflicts. This gives full feature
 * parity with the desktop app, including FTS5 support and WAL
 * concurrency for safe concurrent access to the same DB file.
 */

import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export type { Database as BetterSqlite3Database } from 'better-sqlite3';

function getDbPath(): string {
  if (process.env.READIED_DB_PATH) {
    return process.env.READIED_DB_PATH;
  }

  const home = homedir();
  const platform = process.platform;

  const candidates =
    platform === 'darwin'
      ? [
          join(home, 'Library/Application Support/@readied/desktop/readied.db'),
          join(home, 'Library/Application Support/readied/readied.db'),
        ]
      : platform === 'win32'
        ? [
            join(home, 'AppData/Roaming/@readied/desktop/readied.db'),
            join(home, 'AppData/Roaming/readied/readied.db'),
          ]
        : [
            join(home, '.config/@readied/desktop/readied.db'),
            join(home, '.config/readied/readied.db'),
          ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Readied database not found. Searched:\n${candidates.join('\n')}\n\nSet READIED_DB_PATH environment variable to override.`
  );
}

/**
 * Verify that the SQLite build includes FTS5.
 * Uses sqlite_compileoption_used() to check without touching the schema,
 * avoiding the risk of a stale temp table if the process crashes mid-check.
 */
function assertFts5Available(db: Database.Database): void {
  const row = db.prepare("SELECT sqlite_compileoption_used('ENABLE_FTS5') AS v").get() as
    | { v: number }
    | undefined;
  if (!row || row.v !== 1) {
    throw new Error(
      `FTS5 module is not available in this SQLite build.\n` +
        `The Readied database uses FTS5 for full-text search triggers.\n` +
        `Without FTS5, write operations (create/update/delete notes) will fail.`
    );
  }
}

export function openDb(dbPath?: string): Database.Database {
  const resolvedPath = dbPath ?? getDbPath();
  const db = new Database(resolvedPath);
  if (resolvedPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  assertFts5Available(db);
  return db;
}
