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
export type UserDataPlatform = 'darwin' | 'win32' | 'linux';

export type UserDataRootMarker = 'db' | 'plugins' | 'none';

export interface UserDataRootOptions {
  platform?: NodeJS.Platform | UserDataPlatform;
  home?: string;
  appData?: string;
  exists?: (path: string) => boolean;
  env?: NodeJS.ProcessEnv;
}

/**
 * Electron/product name for userData (`~/.config/Dripnex`, etc.).
 * Distinct from the workspace package name `@dripnex/desktop` (#572).
 */
export const PRODUCT_APP_NAME = 'Dripnex';

export interface ElectronUserDataResolution {
  /** Value for `app.setName`. */
  name: string;
  /** Value for `app.setPath('userData')` / `createDataPaths`. */
  userData: string;
  /** When true, main must call `app.setPath('userData', userData)`. */
  setUserDataPath: boolean;
}

/**
 * Electron userData roots for productName `Dripnex`.
 * Packaged app first, then the electron-vite scoped name, then legacy lowercase.
 */
export function userDataRootCandidates(options: UserDataRootOptions = {}): string[] {
  const platform = options.platform ?? process.platform;
  const home = options.home ?? homedir();
  const env = options.env ?? process.env;

  if (platform === 'darwin') {
    const support = join(home, 'Library', 'Application Support');
    return [
      join(support, 'Dripnex'),
      join(support, '@dripnex', 'desktop'),
      join(support, 'dripnex'),
    ];
  }
  if (platform === 'win32') {
    const roaming = options.appData ?? env.APPDATA ?? join(home, 'AppData', 'Roaming');
    return [
      join(roaming, 'Dripnex'),
      join(roaming, '@dripnex', 'desktop'),
      join(roaming, 'dripnex'),
    ];
  }
  return [
    join(home, '.config', 'Dripnex'),
    join(home, '.config', '@dripnex', 'desktop'),
    join(home, '.config', 'dripnex'),
  ];
}

export function markUserDataRoot(
  root: string,
  exists: (path: string) => boolean = existsSync
): UserDataRootMarker {
  if (exists(join(root, 'dripnex.db'))) return 'db';
  if (exists(join(root, 'plugins'))) return 'plugins';
  return 'none';
}

/**
 * Prefer a root that already has the app database, then one with plugins/,
 * then the packaged `Dripnex` productName path (first candidate).
 */
export function pickUserDataRoot(
  candidates: string[],
  exists: (path: string) => boolean = existsSync
): string {
  const ranked = candidates.map(root => ({ root, marker: markUserDataRoot(root, exists) }));
  return (
    ranked.find(r => r.marker === 'db')?.root ??
    ranked.find(r => r.marker === 'plugins')?.root ??
    candidates[0] ??
    join(homedir(), '.dripnex')
  );
}

/**
 * Resolve the desktop data directory (where dripnex.db and plugins/ live).
 * Honors DRIPNEX_DATA_DIR. CLI and the packaged app must share this root (#547).
 */
export function resolveUserDataRoot(override?: string, options: UserDataRootOptions = {}): string {
  const env = options.env ?? process.env;
  const explicit = override ?? env.DRIPNEX_DATA_DIR;
  if (explicit) return explicit;

  const exists = options.exists ?? existsSync;
  return pickUserDataRoot(userDataRootCandidates(options), exists);
}

/**
 * Chromium `--user-data-dir` / `--user-data-dir=path` already owns userData
 * (e2e, QA flags). Do not call `app.setPath('userData')` in that case.
 */
export function hasExplicitUserDataDir(argv: readonly string[]): boolean {
  return argv.some(arg => arg === '--user-data-dir' || arg.startsWith('--user-data-dir='));
}

/**
 * Resolve the Electron app name and userData root (#572).
 *
 * Packaged Electron follows package.json `name` (`@dripnex/desktop`) unless
 * `app.setName(PRODUCT_APP_NAME)` runs before `app.getPath('userData')`.
 * Same folder as CLI `resolveUserDataRoot`. Does not copy existing
 * `@dripnex/desktop` data — `pickUserDataRoot` keeps that folder if it
 * already has `dripnex.db` or `plugins/`.
 */
export function resolveElectronUserData(
  currentUserData: string,
  options: UserDataRootOptions & { argv?: readonly string[] } = {}
): ElectronUserDataResolution {
  const argv = options.argv ?? process.argv;
  if (hasExplicitUserDataDir(argv)) {
    return {
      name: PRODUCT_APP_NAME,
      userData: currentUserData,
      setUserDataPath: false,
    };
  }
  return {
    name: PRODUCT_APP_NAME,
    userData: resolveUserDataRoot(undefined, options),
    setUserDataPath: true,
  };
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
