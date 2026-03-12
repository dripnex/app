/* eslint-disable no-console */

import { readdirSync, lstatSync } from 'fs';
import { join } from 'path';
import { getPluginsDir, readManifest } from '../utils';

/**
 * List all installed plugins.
 *
 * Scans the plugins directory, reads each manifest.json,
 * and prints a formatted table.
 */
export function listPlugins(): void {
  const pluginsDir = getPluginsDir();

  let entries: string[];
  try {
    entries = readdirSync(pluginsDir);
  } catch {
    console.log('No plugins installed.');
    return;
  }

  // Filter to directories and symlinks only
  const pluginDirs = entries.filter(entry => {
    try {
      const stat = lstatSync(join(pluginsDir, entry));
      return stat.isDirectory() || stat.isSymbolicLink();
    } catch {
      return false;
    }
  });

  if (pluginDirs.length === 0) {
    console.log('No plugins installed.');
    console.log('');
    console.log(`Plugins directory: ${pluginsDir}`);
    return;
  }

  // Collect plugin info
  const plugins = pluginDirs.map(dir => {
    const fullPath = join(pluginsDir, dir);
    const manifest = readManifest(fullPath);
    const isSymlink = lstatSync(fullPath).isSymbolicLink();
    return {
      id: manifest?.id ?? dir,
      name: manifest?.name ?? '(unknown)',
      version: manifest?.version ?? '?',
      status: isSymlink ? 'linked' : manifest ? 'installed' : 'invalid',
    };
  });

  // Calculate column widths
  const headers = { id: 'ID', name: 'Name', version: 'Version', status: 'Status' };
  const colWidths = {
    id: Math.max(headers.id.length, ...plugins.map(p => p.id.length)),
    name: Math.max(headers.name.length, ...plugins.map(p => p.name.length)),
    version: Math.max(headers.version.length, ...plugins.map(p => p.version.length)),
    status: Math.max(headers.status.length, ...plugins.map(p => p.status.length)),
  };

  // Print table
  const row = (id: string, name: string, version: string, status: string) =>
    `  ${id.padEnd(colWidths.id)}  ${name.padEnd(colWidths.name)}  ${version.padEnd(colWidths.version)}  ${status}`;

  console.log('');
  console.log(row(headers.id, headers.name, headers.version, headers.status));
  console.log(
    row(
      '─'.repeat(colWidths.id),
      '─'.repeat(colWidths.name),
      '─'.repeat(colWidths.version),
      '─'.repeat(colWidths.status)
    )
  );
  plugins.forEach(p => console.log(row(p.id, p.name, p.version, p.status)));
  console.log('');
  console.log(`${plugins.length} plugin(s) found in ${pluginsDir}`);
}
