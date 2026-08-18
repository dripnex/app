/**
 * Data Paths Manager
 *
 * Manages application data directory structure.
 * Works with any path provider (Electron app.getPath, Node fs, etc.)
 */

import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface DataPaths {
  /** Root data directory */
  root: string;
  /** Database file path */
  database: string;
  /** Backups directory */
  backups: string;
  /** Logs directory */
  logs: string;
  /** Config file path */
  config: string;
  /** Export directory (temp) */
  exports: string;
  /** Assets directory for embedded files */
  assets: string;
  /** Plugins directory for user-installed plugins */
  plugins: string;
}

/**
 * Create data paths from a root directory.
 * Creates directories if they don't exist.
 */
export function createDataPaths(rootPath: string): DataPaths {
  const paths: DataPaths = {
    root: rootPath,
    database: join(rootPath, 'dripnex.db'),
    backups: join(rootPath, 'backups'),
    logs: join(rootPath, 'logs'),
    config: join(rootPath, 'config.json'),
    exports: join(rootPath, 'exports'),
    assets: join(rootPath, 'assets'),
    plugins: join(rootPath, 'plugins'),
  };

  // Ensure directories exist
  ensureDirectory(paths.root);
  ensureDirectory(paths.backups);
  ensureDirectory(paths.logs);
  ensureDirectory(paths.exports);
  ensureDirectory(paths.assets);
  ensureDirectory(paths.plugins);

  return paths;
}

/**
 * Ensure a directory exists, create if not.
 */
export function ensureDirectory(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

/**
 * Generate backup filename with timestamp.
 */
/** Default Electron userData roots, most specific first. */
export function userDataRootCandidates(): string[] {
  const home = homedir();
  if (process.platform === 'darwin') {
    return [
      join(home, 'Library', 'Application Support', '@dripnex', 'desktop'),
      join(home, 'Library', 'Application Support', 'Dripnex'),
      join(home, 'Library', 'Application Support', 'dripnex'),
    ];
  }
  if (process.platform === 'win32') {
    const roaming = process.env.APPDATA ?? join(home, 'AppData', 'Roaming');
    return [join(roaming, '@dripnex', 'desktop'), join(roaming, 'dripnex')];
  }
  return [join(home, '.config', '@dripnex', 'desktop'), join(home, '.config', 'dripnex')];
}

/**
 * Resolve the desktop data directory (where dripnex.db and plugins/ live).
 * Honors DRIPNEX_DATA_DIR. Otherwise picks the first existing candidate,
 * falling back to `@dripnex/desktop`.
 */
export function resolveUserDataRoot(override?: string): string {
  const explicit = override ?? process.env.DRIPNEX_DATA_DIR;
  if (explicit) return explicit;

  const candidates = userDataRootCandidates();
  for (const root of candidates) {
    if (existsSync(join(root, 'dripnex.db')) || existsSync(join(root, 'plugins'))) {
      return root;
    }
  }
  return candidates[0] ?? join(homedir(), '.dripnex');
}

export function generateBackupFilename(prefix: string = 'backup'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${timestamp}.db`;
}

/**
 * Generate pre-migration backup filename.
 */
export function generateMigrationBackupFilename(fromVersion: number, toVersion: number): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `pre-migration-v${fromVersion}-to-v${toVersion}-${timestamp}.db`;
}
