/**
 * Database connection for the MCP server.
 *
 * Uses node:sqlite (built into Node 22+) — no native compilation, no ABI
 * conflicts with Electron's bundled Node. The MCP server runs as a standalone
 * Node.js process invoked by the host (Claude Code), sharing the same DB file
 * as the desktop app via WAL mode for safe concurrent access. FTS5 ships
 * enabled in node:sqlite's bundled SQLite build.
 */

import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export type Database = DatabaseSync;

function getDbPath(): string {
  if (process.env.DRIPNEX_DB_PATH) {
    return process.env.DRIPNEX_DB_PATH;
  }

  const home = homedir();
  const platform = process.platform;

  const candidates =
    platform === 'darwin'
      ? [
          join(home, 'Library/Application Support/@dripnex/desktop/dripnex.db'),
          join(home, 'Library/Application Support/dripnex/dripnex.db'),
        ]
      : platform === 'win32'
        ? [
            join(home, 'AppData/Roaming/@dripnex/desktop/dripnex.db'),
            join(home, 'AppData/Roaming/dripnex/dripnex.db'),
          ]
        : [
            join(home, '.config/@dripnex/desktop/dripnex.db'),
            join(home, '.config/dripnex/dripnex.db'),
          ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Dripnex database not found. Searched:\n${candidates.join('\n')}\n\nSet DRIPNEX_DB_PATH environment variable to override.`
  );
}

function assertFts5Available(db: DatabaseSync): void {
  const row = db.prepare("SELECT sqlite_compileoption_used('ENABLE_FTS5') AS v").get() as
    | { v: number }
    | undefined;
  if (!row || row.v !== 1) {
    throw new Error(
      `FTS5 module is not available in this SQLite build.\n` +
        `The Dripnex database uses FTS5 for full-text search triggers.\n` +
        `Without FTS5, write operations (create/update/delete notes) will fail.`
    );
  }
}

export function openDb(dbPath?: string): DatabaseSync {
  const resolvedPath = dbPath ?? getDbPath();
  const db = new DatabaseSync(resolvedPath);
  if (resolvedPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL');
  }
  assertFts5Available(db);
  return db;
}
