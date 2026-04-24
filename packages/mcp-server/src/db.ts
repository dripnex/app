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
 * Fails loudly at startup so the error is obvious, rather than
 * surfacing later as a cryptic trigger failure on write operations.
 */
function assertFts5Available(db: Database.Database): void {
  try {
    db.prepare('CREATE VIRTUAL TABLE _fts5_check USING fts5(x)').run();
    db.prepare('DROP TABLE _fts5_check').run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `FTS5 module is not available in this SQLite build.\n` +
        `The Readied database uses FTS5 for full-text search triggers.\n` +
        `Without FTS5, write operations (create/update/delete notes) will fail.\n` +
        `Original error: ${message}`
    );
  }
}

export function openDb(dbPath?: string): Database.Database {
  const resolvedPath = dbPath ?? getDbPath();
  const db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  assertFts5Available(db);
  return db;
}
