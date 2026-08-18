/* eslint-disable no-console */

import { existsSync, symlinkSync, lstatSync } from 'fs';
import { join, resolve } from 'path';
import { getPluginsDir, readManifest } from '../utils';

/**
 * Link a local plugin directory into the plugins directory for development.
 *
 * Creates a symlink from `plugins/<plugin-id>` to the source directory.
 */
export function linkPlugin(source: string): void {
  const sourcePath = resolve(source);

  if (!existsSync(sourcePath)) {
    console.error(`Error: Directory not found: ${sourcePath}`);
    process.exit(1);
  }

  const stat = lstatSync(sourcePath);
  if (!stat.isDirectory()) {
    console.error(`Error: Path is not a directory: ${sourcePath}`);
    process.exit(1);
  }

  const manifest = readManifest(sourcePath);
  if (!manifest) {
    console.error('Error: No valid manifest.json found in the source directory.');
    console.error('       manifest.json must contain at least: id, name, version');
    console.error('');
    console.error('Run "dripnex-plugin init <name>" to scaffold a new plugin.');
    process.exit(1);
  }

  const pluginsDir = getPluginsDir();
  const linkPath = join(pluginsDir, manifest.id);

  if (existsSync(linkPath)) {
    const linkStat = lstatSync(linkPath);
    if (linkStat.isSymbolicLink()) {
      console.error(`Error: Plugin "${manifest.id}" is already linked.`);
      console.error(`       Run "dripnex-plugin uninstall ${manifest.id}" to remove it first.`);
    } else {
      console.error(`Error: Plugin "${manifest.id}" is already installed (not linked).`);
      console.error(`       Run "dripnex-plugin uninstall ${manifest.id}" to remove it first.`);
    }
    process.exit(1);
  }

  try {
    symlinkSync(sourcePath, linkPath, 'dir');
  } catch (err) {
    console.error(
      `Error: Failed to create symlink: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }

  console.log(`Linked "${manifest.name}" (${manifest.id}@${manifest.version})`);
  console.log(`  ${linkPath} -> ${sourcePath}`);
  const mainPath = join(sourcePath, manifest.main ?? 'dist/index.js');
  if (!existsSync(mainPath)) {
    console.log('');
    console.log(`Warning: ${manifest.main ?? 'dist/index.js'} is missing.`);
    console.log('Build the plugin before Dripnex can load it (npm run build).');
  }
  console.log('');
  console.log('Reload plugins from Settings → Plugins, or restart Dripnex.');
}
