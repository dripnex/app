/**
 * Plugin IPC Handlers
 *
 * Handles plugin config persistence, discovery, install, uninstall, and reload.
 */

import { join, normalize, basename } from 'path';
import { readFile, mkdir, rm, readdir, stat, rename } from 'fs/promises';
import { existsSync } from 'fs';
import { execFile } from 'child_process';
import { writeFile } from 'fs/promises';
import { ipcMain, dialog, BrowserWindow, net } from 'electron';
import {
  USER_INIT_FILE,
  USER_KEYMAP_FILE,
  USER_STYLES_FILE,
  openUserHackFile,
} from '../userHackFiles.js';
import { z } from 'zod';
import { defineIpcHandler } from '../ipc/registry.js';
import { broadcastToWindows } from '../windows/broadcast.js';
import { scanPlugins } from '../pluginScanner.js';
import {
  isAllowedPluginHost,
  parseConnectSpec,
  pickReleaseTarball,
  PLUGIN_REGISTRY_URLS,
  resolveRegistryBundle,
  uniqueReleaseTags,
} from '../plugins/githubInstall.js';
import type { DataPaths, Database } from './types.js';

export interface PluginHandlerDeps {
  dataPaths: DataPaths;
  db: Database;
}

// Plugin IDs are constrained the same way we enforce on install (regex check
// on manifest.id). Mirror that here so the IPC boundary catches the same shape.
const PluginIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);
const ConfigKeySchema = z.string().min(1).max(256);

type InstallResult = {
  success: boolean;
  pluginId?: string;
  pluginName?: string;
  error?: string;
  slugMismatch?: string;
};

async function installPluginFromHttpsUrl(
  paths: DataPaths,
  url: string,
  pluginSlug?: string
): Promise<InstallResult> {
  if (!url.startsWith('https://')) {
    return { success: false, error: 'Only HTTPS URLs are allowed' };
  }

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return { success: false, error: 'Invalid URL' };
  }
  if (pluginSlug === undefined && !isAllowedPluginHost(hostname)) {
    return { success: false, error: 'Only GitHub release archives are allowed' };
  }

  await mkdir(paths.plugins, { recursive: true });

  const tmpDir = join(paths.plugins, `__downloading_${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });

  try {
    const response = await net.fetch(url);
    if (!response.ok) {
      return { success: false, error: `Download failed: HTTP ${response.status}` };
    }

    const MAX_PLUGIN_SIZE = 50 * 1024 * 1024;
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_PLUGIN_SIZE) {
      return { success: false, error: 'Plugin archive exceeds maximum size of 50 MB' };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_PLUGIN_SIZE) {
      return { success: false, error: 'Plugin archive exceeds maximum size of 50 MB' };
    }

    const urlPathname = new URL(url).pathname.toLowerCase();
    const isZip = urlPathname.endsWith('.zip');
    const archiveExt = isZip ? '.zip' : '.tar.gz';
    const archivePath = join(tmpDir, `plugin${archiveExt}`);
    await writeFile(archivePath, buffer);

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

    const entries = await readdir(stageDir);
    let pluginSourceDir = stageDir;

    if (entries.length === 1 && entries[0]) {
      const candidatePath = join(stageDir, entries[0]);
      const candidateStat = await stat(candidatePath);
      if (candidateStat.isDirectory()) {
        pluginSourceDir = candidatePath;
      }
    }

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

    if (pluginSlug && manifest.id !== pluginSlug) {
      const wouldOverwrite = join(paths.plugins, manifest.id);
      if (existsSync(wouldOverwrite)) {
        return {
          success: false,
          error: `Archive contains "${manifest.id}" but "${pluginSlug}" was requested. Refusing to overwrite existing plugin.`,
        };
      }
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(manifest.id)) {
      return {
        success: false,
        error: 'Invalid plugin ID: must be alphanumeric with hyphens/underscores only',
      };
    }

    const destDir = join(paths.plugins, manifest.id);
    if (!normalize(destDir).startsWith(normalize(paths.plugins))) {
      return { success: false, error: 'Invalid plugin ID: path traversal detected' };
    }

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
    if (existsSync(tmpDir)) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function resolveConnectUrl(
  spec: Exclude<ReturnType<typeof parseConnectSpec>, { error: string }>
): Promise<{ url: string } | { error: string }> {
  if (spec.kind === 'registry') {
    return resolveRegistryBundle(spec.slug, url => net.fetch(url));
  }

  if (spec.kind === 'url') {
    let hostname: string;
    try {
      hostname = new URL(spec.url).hostname;
    } catch {
      return { error: 'Invalid URL' };
    }
    if (!isAllowedPluginHost(hostname)) {
      return { error: 'Only GitHub release archives are allowed' };
    }
    return { url: spec.url };
  }

  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Dripnex',
  };
  const urls = spec.tag
    ? uniqueReleaseTags(spec.tag).map(
        t => `https://api.github.com/repos/${spec.owner}/${spec.repo}/releases/tags/${encodeURIComponent(t)}`
      )
    : [`https://api.github.com/repos/${spec.owner}/${spec.repo}/releases/latest`];

  let lastStatus = 0;
  for (const api of urls) {
    const res = await net.fetch(api, { headers });
    lastStatus = res.status;
    if (res.status === 404) continue;
    if (!res.ok) return { error: `GitHub returned ${res.status} for ${spec.owner}/${spec.repo}` };
    const body = (await res.json()) as {
      tag_name?: string;
      assets?: Array<{ name?: string; browser_download_url?: string }>;
    };
    const tarball = pickReleaseTarball(body.assets ?? []);
    if (!tarball) {
      return {
        error: `Release ${body.tag_name ?? spec.tag ?? 'latest'} of ${spec.owner}/${spec.repo} has no .tar.gz. Authors: dripnex-plugin pack.`,
      };
    }
    return { url: tarball };
  }

  return {
    error: `No GitHub release found for ${spec.owner}/${spec.repo}${spec.tag ? `@${spec.tag}` : ''}${lastStatus ? ` (${lastStatus})` : ''}.`,
  };
}

export function registerPluginHandlers(deps: PluginHandlerDeps): void {
  const { dataPaths: paths, db: database } = deps;

  // ═══════════════════════════════════════════════════════════════════════════
  // Plugin Config Persistence
  // ═══════════════════════════════════════════════════════════════════════════

  defineIpcHandler({
    channel: 'pluginConfig:get',
    args: z.tuple([PluginIdSchema, ConfigKeySchema]),
    handler: (pluginId, key) => {
      const row = database
        .prepare('SELECT value FROM plugin_config WHERE plugin_id = ? AND key = ?')
        .get(pluginId, key) as { value: string } | undefined;
      return row ? JSON.parse(row.value) : undefined;
    },
  });

  defineIpcHandler({
    channel: 'pluginConfig:set',
    args: z.tuple([PluginIdSchema, ConfigKeySchema, z.unknown()]),
    handler: (pluginId, key, value) => {
      database
        .prepare('INSERT OR REPLACE INTO plugin_config (plugin_id, key, value) VALUES (?, ?, ?)')
        .run(pluginId, key, JSON.stringify(value));
      broadcastToWindows('pluginConfig:changed', pluginId, key, value);
    },
  });

  defineIpcHandler({
    channel: 'pluginConfig:getAll',
    args: z.tuple([PluginIdSchema]),
    handler: pluginId => {
      const rows = database
        .prepare('SELECT key, value FROM plugin_config WHERE plugin_id = ?')
        .all(pluginId) as Array<{ key: string; value: string }>;
      const result: Record<string, unknown> = {};
      for (const row of rows) {
        result[row.key] = JSON.parse(row.value);
      }
      return result;
    },
  });

  defineIpcHandler({
    channel: 'pluginConfig:clear',
    args: z.tuple([PluginIdSchema]),
    handler: pluginId => {
      database.prepare('DELETE FROM plugin_config WHERE plugin_id = ?').run(pluginId);
    },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Plugin Discovery
  // ═══════════════════════════════════════════════════════════════════════════

  defineIpcHandler({
    channel: 'plugins:scan',
    args: z.tuple([]),
    handler: () => scanPlugins(paths.plugins),
  });

  defineIpcHandler({
    channel: 'plugins:isEnabled',
    args: z.tuple([PluginIdSchema]),
    handler: pluginId => {
      const row = database
        .prepare('SELECT enabled FROM plugin_registry WHERE plugin_id = ?')
        .get(pluginId) as { enabled: number } | undefined;
      return row ? row.enabled === 1 : true;
    },
  });

  defineIpcHandler({
    channel: 'plugins:setEnabled',
    args: z.tuple([PluginIdSchema, z.boolean()]),
    handler: (pluginId, enabled) => {
      database
        .prepare(
          'INSERT INTO plugin_registry (plugin_id, enabled) VALUES (?, ?) ON CONFLICT(plugin_id) DO UPDATE SET enabled = ?'
        )
        .run(pluginId, enabled ? 1 : 0, enabled ? 1 : 0);
    },
  });

  defineIpcHandler({
    channel: 'plugins:listState',
    args: z.tuple([]),
    handler: () => {
      const rows = database
        .prepare('SELECT plugin_id, enabled FROM plugin_registry')
        .all() as Array<{
        plugin_id: string;
        enabled: number;
      }>;
      return rows.map(row => ({
        pluginId: row.plugin_id,
        enabled: row.enabled === 1,
      }));
    },
  });

  defineIpcHandler({
    channel: 'plugins:readInitScript',
    args: z.tuple([]),
    handler: async () => {
      try {
        return await readFile(join(paths.root, USER_INIT_FILE), 'utf-8');
      } catch {
        return null;
      }
    },
  });

  defineIpcHandler({
    channel: 'plugins:readUserStyles',
    args: z.tuple([]),
    handler: async () => {
      try {
        return await readFile(join(paths.root, USER_STYLES_FILE), 'utf-8');
      } catch {
        return null;
      }
    },
  });

  defineIpcHandler({
    channel: 'plugins:readKeymap',
    args: z.tuple([]),
    handler: async () => {
      try {
        return await readFile(join(paths.root, USER_KEYMAP_FILE), 'utf-8');
      } catch {
        return null;
      }
    },
  });

  defineIpcHandler({
    channel: 'plugins:openUserFile',
    args: z.tuple([z.enum(['init', 'styles', 'keymap'])]),
    handler: async kind => openUserHackFile(paths.root, kind),
  });

  defineIpcHandler({
    channel: 'plugins:install',
    args: z.tuple([]),
    handler: async () => {
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
    },
  });

  defineIpcHandler({
    channel: 'plugins:installFromUrl',
    args: z.tuple([z.string().url().startsWith('https://').max(2048), PluginIdSchema]),
    handler: async (url, pluginSlug) => installPluginFromHttpsUrl(paths, url, pluginSlug),
  });

  defineIpcHandler({
    channel: 'plugins:listRegistry',
    args: z.tuple([]),
    handler: async () => {
      for (const base of [...new Set(PLUGIN_REGISTRY_URLS)]) {
        try {
          const res = await net.fetch(`${base.replace(/\/$/, '')}/plugins`, {
            headers: { Accept: 'application/json', 'User-Agent': 'Dripnex' },
          });
          if (!res.ok) continue;
          const body = (await res.json()) as {
            plugins?: Array<{
              slug: string;
              name: string;
              description: string;
              version: string;
              author: string;
              repositoryUrl?: string | null;
              bundleUrl?: string | null;
            }>;
          };
          if (Array.isArray(body.plugins)) {
            return {
              source: 'registry' as const,
              plugins: body.plugins.map(p => ({
                slug: p.slug,
                name: p.name,
                description: p.description,
                version: p.version,
                author: p.author,
                repositoryUrl: p.repositoryUrl ?? null,
                bundleUrl: p.bundleUrl ?? null,
              })),
            };
          }
        } catch {
          continue;
        }
      }
      return { source: 'fallback' as const, plugins: [] };
    },
  });

  defineIpcHandler({
    channel: 'plugins:installFromSpec',
    args: z.tuple([z.string().trim().min(1).max(256)]),
    handler: async specText => {
      const spec = parseConnectSpec(specText);
      if ('error' in spec) {
        return { success: false, error: spec.error };
      }
      const resolved = await resolveConnectUrl(spec);
      if ('error' in resolved) {
        return { success: false, error: resolved.error };
      }
      return installPluginFromHttpsUrl(paths, resolved.url);
    },
  });

  defineIpcHandler({
    channel: 'plugins:uninstall',
    args: z.tuple([PluginIdSchema]),
    handler: async pluginId => {
      // Safety: only allow removing from the plugins directory, prevent path traversal
      const pluginDir = join(paths.plugins, pluginId);
      const normalizedDir = normalize(pluginDir);

      if (!normalizedDir.startsWith(normalize(paths.plugins))) {
        return { success: false, error: 'Invalid plugin ID' };
      }

      if (!existsSync(pluginDir)) {
        return { success: false, error: 'Plugin not found' };
      }

      try {
        await rm(pluginDir, { recursive: true, force: true });
        database.prepare('DELETE FROM plugin_registry WHERE plugin_id = ?').run(pluginId);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  });

  // plugins:requestReload uses ipcMain.on (fire-and-forget, not invoke),
  // so defineIpcHandler doesn't apply — left raw.
  ipcMain.on('plugins:requestReload', () => {
    for (const win of BrowserWindow.getAllWindows()) {
      try {
        if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
          win.webContents.send('plugins:reload');
        }
      } catch {
        // Window destroyed during iteration
      }
    }
  });
}
