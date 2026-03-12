/**
 * Plugin Scanner
 *
 * Scans the plugins directory for subdirectories with manifest.json.
 * Reads each plugin's JS entry point as a string for renderer evaluation.
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import type { PluginConfigSchemaField } from '@readied/plugin-api';

export type { PluginConfigSchemaField };

export interface ScannedPlugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  configSchema?: Record<string, PluginConfigSchemaField>;
  code: string;
  path: string;
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

      results.push({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        configSchema: manifest.configSchema,
        code,
        path: pluginDir,
      });
    } catch {
      // Skip directories that don't have a valid manifest or entry file
    }
  }

  return results;
}
