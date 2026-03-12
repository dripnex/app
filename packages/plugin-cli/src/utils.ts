import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, readFileSync } from 'fs';

export function getPluginsDir(): string {
  const base =
    process.platform === 'darwin'
      ? join(homedir(), 'Library', 'Application Support', 'readied')
      : process.platform === 'win32'
        ? join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'readied')
        : join(homedir(), '.config', 'readied');
  const pluginsDir = join(base, 'plugins');
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
