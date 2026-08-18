import { join } from 'path';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { resolveUserDataRoot } from '@dripnex/storage-core';

export function getPluginsDir(): string {
  const pluginsDir = join(resolveUserDataRoot(), 'plugins');
  if (!existsSync(pluginsDir)) {
    mkdirSync(pluginsDir, { recursive: true });
  }
  return pluginsDir;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  main?: string;
}

export function readManifest(pluginDir: string): PluginManifest | null {
  const manifestPath = join(pluginDir, 'manifest.json');
  try {
    const content = readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(content);
    if (!manifest.id || !manifest.name || !manifest.version) return null;
    return manifest;
  } catch {
    return null;
  }
}
