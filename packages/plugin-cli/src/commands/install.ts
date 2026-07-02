/* eslint-disable no-console */

import { existsSync, statSync, mkdirSync, cpSync, rmSync, readdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, resolve, basename } from 'path';
import { tmpdir } from 'os';
import { getPluginsDir, readManifest } from '../utils';

/**
 * Install a plugin from a local directory or archive (.tar.gz, .tgz, .zip).
 */
export function installPlugin(source: string): void {
  if (!source) {
    console.error('Usage: dripnex-plugin install <path>');
    console.error('');
    console.error('  <path>  Path to a plugin directory, .tar.gz, .tgz, or .zip file');
    console.error('');
    console.error('Examples:');
    console.error('  dripnex-plugin install ./my-plugin');
    console.error('  dripnex-plugin install plugin-v1.0.0.tar.gz');
    process.exit(1);
  }

  const sourcePath = resolve(source);

  if (!existsSync(sourcePath)) {
    console.error(`Error: Path not found: ${sourcePath}`);
    process.exit(1);
  }

  const stat = statSync(sourcePath);
  let pluginSourceDir: string;
  let tempDir: string | null = null;

  if (stat.isDirectory()) {
    pluginSourceDir = sourcePath;
  } else if (stat.isFile()) {
    // Extract archive to a temp directory
    tempDir = join(tmpdir(), `dripnex-plugin-install-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    try {
      const name = basename(sourcePath).toLowerCase();
      if (name.endsWith('.tar.gz') || name.endsWith('.tgz')) {
        execFileSync('tar', ['-xzf', sourcePath, '-C', tempDir], { stdio: 'pipe' });
      } else if (name.endsWith('.zip')) {
        execFileSync('unzip', ['-q', sourcePath, '-d', tempDir], { stdio: 'pipe' });
      } else {
        console.error('Error: Unsupported archive format. Use .tar.gz, .tgz, or .zip');
        process.exit(1);
      }
    } catch (err) {
      cleanup(tempDir);
      console.error(
        `Error: Failed to extract archive: ${err instanceof Error ? err.message : String(err)}`
      );
      process.exit(1);
    }

    // The archive may contain a single directory or files at the root
    const foundRoot = findPluginRoot(tempDir);
    if (!foundRoot) {
      cleanup(tempDir);
      console.error('Error: Could not find a valid manifest.json in the extracted archive.');
      console.error('       The archive must contain a manifest.json with id, name, and version.');
      return process.exit(1);
    }
    pluginSourceDir = foundRoot;
  } else {
    console.error('Error: Path must be a directory or archive file.');
    process.exit(1);
  }

  // Validate manifest
  const manifest = readManifest(pluginSourceDir);
  if (!manifest) {
    cleanup(tempDir);
    console.error('Error: Invalid or missing manifest.json');
    console.error('       manifest.json must contain at least: id, name, version');
    process.exit(1);
  }

  const pluginsDir = getPluginsDir();
  const targetDir = join(pluginsDir, manifest.id);

  if (existsSync(targetDir)) {
    cleanup(tempDir);
    console.error(`Error: Plugin "${manifest.id}" is already installed at ${targetDir}`);
    console.error('       Run "dripnex-plugin uninstall ' + manifest.id + '" first.');
    process.exit(1);
  }

  // Copy plugin to plugins directory
  try {
    cpSync(pluginSourceDir, targetDir, { recursive: true });
  } catch (err) {
    cleanup(tempDir);
    console.error(
      `Error: Failed to copy plugin: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }

  cleanup(tempDir);

  console.log(`Installed "${manifest.name}" (${manifest.id}@${manifest.version})`);
  console.log(`  Location: ${targetDir}`);
}

/**
 * Find the directory containing manifest.json in an extracted archive.
 * It could be at the root or one level deep (common with tar/zip).
 */
function findPluginRoot(dir: string): string | null {
  // Check if manifest.json is at the root
  if (readManifest(dir)) return dir;

  // Check one level deep
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const sub = join(dir, entry);
    try {
      if (statSync(sub).isDirectory() && readManifest(sub)) {
        return sub;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function cleanup(tempDir: string | null): void {
  if (tempDir && existsSync(tempDir)) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  }
}
