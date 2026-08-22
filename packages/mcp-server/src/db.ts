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
import { resolveUserDataRoot, userDataRootCandidates } from '@dripnex/storage-core';

export type Database = DatabaseSync;

export function resolveDbPath(override?: string): string {
  if (override) return override;
  return findDbPath();
}

/** Resolve the DB path without throwing — used for the write-gate sidecar when talking HTTP. */
export function tryResolveDbPath(override?: string): string | undefined {
  try {
    return resolveDbPath(override);
  } catch {
    return undefined;
  }
}

function findDbPath(): string {
  if (process.env.DRIPNEX_DB_PATH) {
    return process.env.DRIPNEX_DB_PATH;
  }

  const preferred = join(resolveUserDataRoot(), 'dripnex.db');
  if (existsSync(preferred)) return preferred;

  const searched = userDataRootCandidates().map(root => join(root, 'dripnex.db'));
  throw new Error(
    `Dripnex database not found. Searched:\n${searched.join('\n')}\n\nSet DRIPNEX_DB_PATH or DRIPNEX_DATA_DIR to override.`
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
  const resolvedPath = resolveDbPath(dbPath);
  const db = new DatabaseSync(resolvedPath);
  if (resolvedPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA busy_timeout = 5000');
  }
  assertFts5Available(db);
  return db;
}
