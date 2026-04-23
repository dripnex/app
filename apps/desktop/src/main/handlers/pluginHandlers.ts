/**
 * Plugin IPC Handlers
 *
 * Handles plugin config persistence, discovery, install, uninstall, and reload.
 */

import { join, normalize, basename } from 'path';
import { readFile, mkdir, rm, readdir, stat, rename } from 'fs/promises';
import { existsSync } from 'fs';
import { execFile } from 'child_process';
import { ipcMain, dialog, BrowserWindow, net } from 'electron';
import type { DataPaths, Database } from './types.js';
import { scanPlugins } from '../pluginScanner.js';
import { writeFile } from 'fs/promises';

export interface PluginHandlerDeps {
  dataPaths: DataPaths;
  db: Database;
}

export function registerPluginHandlers(deps: PluginHandlerDeps): void {
  const { dataPaths: paths, db: database } = deps;

  // ═══════════════════════════════════════════════════════════════════════════
  // Plugin Config Persistence
  // ═══════════════════════════════════════════════════════════════════════════

  ipcMain.handle('pluginConfig:get', (_event, pluginId: string, key: string) => {
    const row = database
      .prepare('SELECT value FROM plugin_config WHERE plugin_id = ? AND key = ?')
      .get(pluginId, key) as { value: string } | undefined;
    return row ? JSON.parse(row.value) : undefined;
  });

  ipcMain.handle('pluginConfig:set', (_event, pluginId: string, key: string, value: unknown) => {
    database
      .prepare('INSERT OR REPLACE INTO plugin_config (plugin_id, key, value) VALUES (?, ?, ?)')
      .run(pluginId, key, JSON.stringify(value));
  });

  ipcMain.handle('pluginConfig:getAll', (_event, pluginId: string) => {
    const rows = database
      .prepare('SELECT key, value FROM plugin_config WHERE plugin_id = ?')
      .all(pluginId) as Array<{ key: string; value: string }>;
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[row.key] = JSON.parse(row.value);
    }
    return result;
  });

  ipcMain.handle('pluginConfig:clear', (_event, pluginId: string) => {
    database.prepare('DELETE FROM plugin_config WHERE plugin_id = ?').run(pluginId);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Plugin Discovery
  // ═══════════════════════════════════════════════════════════════════════════

  // Scan filesystem for plugins
  ipcMain.handle('plugins:scan', async () => {
    return scanPlugins(paths.plugins);
  });

  // Check if a plugin is enabled (default: true if no row exists)
  ipcMain.handle('plugins:isEnabled', (_event, pluginId: string) => {
    const row = database
      .prepare('SELECT enabled FROM plugin_registry WHERE plugin_id = ?')
      .get(pluginId) as { enabled: number } | undefined;
    return row ? row.enabled === 1 : true;
  });

  // Set plugin enabled/disabled state
  ipcMain.handle('plugins:setEnabled', (_event, pluginId: string, enabled: boolean) => {
    database
      .prepare(
        'INSERT INTO plugin_registry (plugin_id, enabled) VALUES (?, ?) ON CONFLICT(plugin_id) DO UPDATE SET enabled = ?'
      )
      .run(pluginId, enabled ? 1 : 0, enabled ? 1 : 0);
  });

  // List all plugin registry state
  ipcMain.handle('plugins:listState', () => {
    const rows = database.prepare('SELECT plugin_id, enabled FROM plugin_registry').all() as Array<{
      plugin_id: string;
      enabled: number;
    }>;
    return rows.map(row => ({
      pluginId: row.plugin_id,
      enabled: row.enabled === 1,
    }));
  });

  // Read init.js user script (returns null if not found)
  ipcMain.handle('plugins:readInitScript', async () => {
    const initPath = join(paths.root, 'init.js');
    try {
      const code = await readFile(initPath, 'utf-8');
      return code;
    } catch {
      return null;
    }
  });

  // Install plugin from archive (.tar.gz or .zip)
  ipcMain.handle('plugins:install', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Install Plugin',
      properties: ['openFile'],
      filters: [{ name: 'Plugin Archive', extensions: ['tar.gz', 'tgz', 'zip'] }],
      buttonLabel: 'Install',
    });

    if (canceled || !filePaths[0]) {
      return { success: false, error: 'Cancelled' };
    }

    const archivePath = filePaths[0];
    const fileName = basename(archivePath).toLowerCase();

    // Hoist tmpDir so it can be cleaned up in finally
    let tmpDir: string | null = null;

    try {
      // Ensure plugins dir exists
      await mkdir(paths.plugins, { recursive: true });

      // Extract to a temp dir first, then move validated plugin folder
      tmpDir = join(paths.plugins, `__installing_${Date.now()}`);
      const extractDir = tmpDir;
      await mkdir(extractDir, { recursive: true });

      await new Promise<void>((resolve, reject) => {
        const cb = (error: Error | null) => {
          if (error) reject(error);
          else resolve();
        };
        if (fileName.endsWith('.zip')) {
          if (process.platform === 'win32') {
            execFile(
              'powershell',
              [
                '-NoProfile',
                '-NonInteractive',
                '-Command',
                'Expand-Archive',
                '-Force',
                '-Path',
                archivePath,
                '-DestinationPath',
                extractDir,
              ],
              cb
            );
          } else {
            execFile('unzip', ['-o', archivePath, '-d', extractDir], cb);
          }
        } else {
          execFile('tar', ['-xzf', archivePath, '-C', extractDir], cb);
        }
      });

      // Find the manifest.json — could be at root or one level deep
      const entries = await readdir(extractDir);
      let pluginSourceDir = extractDir;

      // If there's a single subdirectory, use that as the plugin root
      if (entries.length === 1 && entries[0]) {
        const candidatePath = join(extractDir, entries[0]);
        const candidateStat = await stat(candidatePath);
        if (candidateStat.isDirectory()) {
          pluginSourceDir = candidatePath;
        }
      }

      // Validate: must have manifest.json
      const manifestPath = join(pluginSourceDir, 'manifest.json');
      if (!existsSync(manifestPath)) {
        return { success: false, error: 'No manifest.json found in archive' };
      }

      const manifestRaw = await readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);
      if (!manifest.id || !manifest.name) {
        return { success: false, error: 'Invalid manifest: missing id or name' };
      }

      // Validate plugin ID - only allow alphanumeric, hyphens, underscores
      if (!/^[a-zA-Z0-9_-]+$/.test(manifest.id)) {
        return {
          success: false,
          error: 'Invalid plugin ID: must be alphanumeric with hyphens/underscores only',
        };
      }

      // Verify path doesn't escape plugins directory
      const destDir = join(paths.plugins, manifest.id);
      if (!normalize(destDir).startsWith(normalize(paths.plugins))) {
        return { success: false, error: 'Invalid plugin ID: path traversal detected' };
      }

      // Move to final destination
      if (existsSync(destDir)) {
        await rm(destDir, { recursive: true, force: true });
      }

      await rename(pluginSourceDir, destDir);

      return { success: true, pluginId: manifest.id, pluginName: manifest.name };
    } catch (error) {
      return { success: false, error: String(error) };
    } finally {
      if (tmpDir && existsSync(tmpDir)) {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  });

  // Install plugin from a remote URL (marketplace download)
  ipcMain.handle('plugins:installFromUrl', async (_event, url: string, pluginSlug: string) => {
    // Safety: only allow https URLs
    if (!url.startsWith('https://')) {
      return { success: false, error: 'Only HTTPS URLs are allowed' };
    }

    // Ensure plugins dir exists
    await mkdir(paths.plugins, { recursive: true });

    // Download to a temp file inside the plugins dir
    const tmpDir = join(paths.plugins, `__downloading_${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });

    try {
      const response = await net.fetch(url);
      if (!response.ok) {
        return { success: false, error: `Download failed: HTTP ${response.status}` };
      }

      // Limit download size to 50 MB
      const MAX_PLUGIN_SIZE = 50 * 1024 * 1024;
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_PLUGIN_SIZE) {
        return { success: false, error: 'Plugin archive exceeds maximum size of 50 MB' };
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > MAX_PLUGIN_SIZE) {
        return { success: false, error: 'Plugin archive exceeds maximum size of 50 MB' };
      }

      // Determine archive type from URL pathname
      const urlPathname = new URL(url).pathname.toLowerCase();
      const isZip = urlPathname.endsWith('.zip');
      const archiveExt = isZip ? '.zip' : '.tar.gz';
      const archivePath = join(tmpDir, `plugin${archiveExt}`);
      await writeFile(archivePath, buffer);

      // Extract to a staging dir
      const stageDir = join(tmpDir, 'extracted');
      await mkdir(stageDir, { recursive: true });

      await new Promise<void>((resolve, reject) => {
        const cb = (error: Error | null) => {
          if (error) reject(error);
          else resolve();
        };
        if (isZip) {
          if (process.platform === 'win32') {
            execFile(
              'powershell',
              [
                '-NoProfile',
                '-NonInteractive',
                '-Command',
                'Expand-Archive',
                '-Force',
                '-Path',
                archivePath,
                '-DestinationPath',
                stageDir,
              ],
              cb
            );
          } else {
            execFile('unzip', ['-o', archivePath, '-d', stageDir], cb);
          }
        } else {
          execFile('tar', ['-xzf', archivePath, '-C', stageDir], cb);
        }
      });

      // Find manifest.json — could be at root or one level deep
      const entries = await readdir(stageDir);
      let pluginSourceDir = stageDir;

      if (entries.length === 1 && entries[0]) {
        const candidatePath = join(stageDir, entries[0]);
        const candidateStat = await stat(candidatePath);
        if (candidateStat.isDirectory()) {
          pluginSourceDir = candidatePath;
        }
      }

      // Validate: must have manifest.json
      const manifestPath = join(pluginSourceDir, 'manifest.json');
      if (!existsSync(manifestPath)) {
        return { success: false, error: 'No manifest.json found in downloaded archive' };
      }

      const manifestRaw = await readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);
      if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) {
        return { success: false, error: 'Invalid manifest: not a JSON object' };
      }
      if (!manifest.id || !manifest.name) {
        return { success: false, error: 'Invalid manifest: missing id or name' };
      }

      // Cross-plugin overwrite protection: if we requested plugin A but the
      // archive contains plugin B, block when it would overwrite an existing plugin
      if (pluginSlug && manifest.id !== pluginSlug) {
        const wouldOverwrite = join(paths.plugins, manifest.id);
        if (existsSync(wouldOverwrite)) {
          return {
            success: false,
            error: `Archive contains "${manifest.id}" but "${pluginSlug}" was requested. Refusing to overwrite existing plugin.`,
          };
        }
      }

      // Validate plugin ID - only allow alphanumeric, hyphens, underscores
      if (!/^[a-zA-Z0-9_-]+$/.test(manifest.id)) {
        return {
          success: false,
          error: 'Invalid plugin ID: must be alphanumeric with hyphens/underscores only',
        };
      }

      // Verify path doesn't escape plugins directory
      const destDir = join(paths.plugins, manifest.id);
      if (!normalize(destDir).startsWith(normalize(paths.plugins))) {
        return { success: false, error: 'Invalid plugin ID: path traversal detected' };
      }

      // Move to final destination
      if (existsSync(destDir)) {
        await rm(destDir, { recursive: true, force: true });
      }

      await rename(pluginSourceDir, destDir);

      return {
        success: true,
        pluginId: manifest.id,
        pluginName: manifest.name,
        slugMismatch: pluginSlug && manifest.id !== pluginSlug ? pluginSlug : undefined,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    } finally {
      // Always clean up temp dir
      if (existsSync(tmpDir)) {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  });

  // Uninstall plugin (remove its directory)
  ipcMain.handle('plugins:uninstall', async (_event, pluginId: string) => {
    // Safety: only allow removing from the plugins directory, prevent path traversal
    const safeName = pluginId.replace(/[^a-z0-9-]/g, '');
    const pluginDir = join(paths.plugins, safeName);
    const normalizedDir = normalize(pluginDir);

    if (!normalizedDir.startsWith(normalize(paths.plugins))) {
      return { success: false, error: 'Invalid plugin ID' };
    }

    if (!existsSync(pluginDir)) {
      return { success: false, error: 'Plugin not found' };
    }

    try {
      await rm(pluginDir, { recursive: true, force: true });
      // Clean up registry entry
      database.prepare('DELETE FROM plugin_registry WHERE plugin_id = ?').run(pluginId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Request plugin reload: broadcast to all windows except sender
  ipcMain.on('plugins:requestReload', event => {
    const senderWebContents = event.sender;
    for (const win of BrowserWindow.getAllWindows()) {
      try {
        if (
          win.webContents !== senderWebContents &&
          !win.isDestroyed() &&
          !win.webContents.isDestroyed()
        ) {
          win.webContents.send('plugins:reload');
        }
      } catch {
        // Window destroyed during iteration
      }
    }
  });
}
