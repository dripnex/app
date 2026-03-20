/**
 * Database connection for the MCP server.
 *
 * Opens the Readied SQLite database using sql.js (WASM-based).
 * This avoids native module conflicts with Electron's better-sqlite3.
 */

import initSqlJs, { type Database } from 'sql.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export type { Database } from 'sql.js';

let dbPath: string;

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

export async function openDb(): Promise<Database> {
  dbPath = getDbPath();
  const SQL = await initSqlJs();
  const buffer = readFileSync(dbPath);
  return new SQL.Database(buffer);
}

/**
 * Save the database back to disk after writes.
 */
export function saveDb(db: Database): void {
  const data = db.export();
  writeFileSync(dbPath, Buffer.from(data));
}
