/* eslint-disable no-console */

import { existsSync, rmSync, lstatSync, readlinkSync } from 'fs';
import { join, resolve, sep } from 'path';
import { createInterface } from 'readline';
import { getPluginsDir, readManifest } from '../utils';

/**
 * Uninstall a plugin by its ID.
 */
export async function uninstallPlugin(pluginId: string): Promise<void> {
  if (!pluginId) {
    console.error('Usage: readied-plugin uninstall <plugin-id>');
    console.error('');
    console.error('Run "readied-plugin list" to see installed plugins.');
    process.exit(1);
  }

  const pluginsDir = getPluginsDir();
  const pluginDir = join(pluginsDir, pluginId);

  // Safety: ensure the resolved path is a strict child of the plugins directory
  const resolvedPluginDir = resolve(pluginDir);
  const resolvedPluginsDir = resolve(pluginsDir);
  if (
    !resolvedPluginDir.startsWith(resolvedPluginsDir + sep) ||
    resolvedPluginDir === resolvedPluginsDir
  ) {
    console.error('Error: Invalid plugin ID.');
    process.exit(1);
  }

  if (!existsSync(pluginDir)) {
    console.error(`Error: Plugin "${pluginId}" is not installed.`);
    console.error('');
    console.error('Run "readied-plugin list" to see installed plugins.');
    process.exit(1);
  }

  const manifest = readManifest(pluginDir);
  const displayName = manifest ? `${manifest.name} (${manifest.id}@${manifest.version})` : pluginId;
  const isSymlink = lstatSync(pluginDir).isSymbolicLink();

  if (isSymlink) {
    const target = readlinkSync(pluginDir);
    console.log(`Plugin "${displayName}" is a symlink to: ${target}`);
    console.log('Only the symlink will be removed, not the source directory.');
  }

  // Ask for confirmation
  const confirmed = await confirm(`Remove plugin "${displayName}"? (y/N) `);
  if (!confirmed) {
    console.log('Aborted.');
    return;
  }

  try {
    if (isSymlink) {
      // Remove just the symlink
      rmSync(pluginDir);
    } else {
      rmSync(pluginDir, { recursive: true, force: true });
    }
    console.log(`Uninstalled "${displayName}".`);
  } catch (err) {
    console.error(
      `Error: Failed to remove plugin: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }
}

function confirm(prompt: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}
