/**
 * Plugin Scanner
 *
 * Scans the plugins directory for subdirectories with manifest.json.
 * Reads each plugin's JS entry point as a string for renderer evaluation.
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import type { PluginConfigSchemaField } from '@dripnex/plugin-api';

export type { PluginConfigSchemaField };

export interface ScannedPlugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  configSchema?: Record<string, PluginConfigSchemaField>;
  code: string;
  path: string;
  keymaps: string[];
  menus: string[];
  styles: string[];
}

interface PluginManifestJson {
  id: string;
  name: string;
  version: string;
  description?: string;
  main: string;
  configSchema?: Record<string, PluginConfigSchemaField>;
}

export async function scanPlugins(pluginsDir: string): Promise<ScannedPlugin[]> {
  const results: ScannedPlugin[] = [];

  let entries: string[];
  try {
    entries = await readdir(pluginsDir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    const pluginDir = join(pluginsDir, entry);

    try {
      const info = await stat(pluginDir);
      if (!info.isDirectory()) continue;

      const manifestPath = join(pluginDir, 'manifest.json');
      const manifestRaw = await readFile(manifestPath, 'utf-8');
      const manifest: PluginManifestJson = JSON.parse(manifestRaw);

      if (!manifest.id || !manifest.name || !manifest.version || !manifest.main) {
        continue;
      }

      const entryPath = join(pluginDir, manifest.main);
      const code = await readFile(entryPath, 'utf-8');
      const [keymaps, menus, styles] = await Promise.all([
        readJsonDir(join(pluginDir, 'keymaps')),
        readJsonDir(join(pluginDir, 'menus')),
        readCssDir(join(pluginDir, 'styles')),
      ]);

      results.push({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        configSchema: manifest.configSchema,
        code,
        path: pluginDir,
        keymaps,
        menus,
        styles,
      });
    } catch {
      // Skip directories that don't have a valid manifest or entry file
    }
  }

  return results;
}

async function readJsonDir(dir: string): Promise<string[]> {
  return readDirByExt(dir, '.json');
}

async function readCssDir(dir: string): Promise<string[]> {
  return readDirByExt(dir, '.css');
}

async function readDirByExt(dir: string, ext: string): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const name of names.sort()) {
    if (!name.endsWith(ext)) continue;
    try {
      files.push(await readFile(join(dir, name), 'utf-8'));
    } catch {
      // skip unreadable members
    }
  }
  return files;
}
