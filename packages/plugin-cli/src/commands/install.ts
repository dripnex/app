/* eslint-disable no-console */

import { existsSync, statSync, mkdirSync, cpSync, rmSync, readdirSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, resolve, basename } from 'path';
import { tmpdir } from 'os';
import { getPluginsDir, readManifest } from '../utils';
import { parseInstallSource } from '../installSpec';

interface GithubRelease {
  tag_name?: string;
  assets?: Array<{ name: string; browser_download_url: string }>;
}

/**
 * Install a plugin from a local directory, archive, GitHub repo, or release URL.
 *
 * A community plugin is its own git repo. Version = git tag. Artifact = the
 * tarball from `dripnex-plugin pack` attached to that GitHub release.
 */
export async function installPlugin(source: string): Promise<void> {
  if (!source) {
    console.error('Usage: dripnex-plugin install <spec>');
    console.error('');
    console.error('  <spec>  Directory, .tar.gz, owner/repo[@tag], or a release URL');
    console.error('');
    console.error('Examples:');
    console.error('  dripnex-plugin install ./my-plugin');
    console.error('  dripnex-plugin install plugin-v1.0.0.tar.gz');
    console.error('  dripnex-plugin install acme/mermaid-plus');
    console.error('  dripnex-plugin install acme/mermaid-plus@v1.2.3');
    process.exit(1);
  }

  const spec = parseInstallSource(source, p => existsSync(resolve(p)));
  let localPath: string;
  let downloaded: string | null = null;

  if (spec.kind === 'path') {
    localPath = resolve(spec.path);
  } else if (spec.kind === 'url') {
    downloaded = await downloadArchive(spec.url);
    localPath = downloaded;
  } else if (spec.kind === 'registry') {
    const url = await resolveRegistryAsset(spec.slug);
    downloaded = await downloadArchive(url);
    localPath = downloaded;
  } else {
    const url = await resolveGithubAsset(spec.owner, spec.repo, spec.tag);
    downloaded = await downloadArchive(url);
    localPath = downloaded;
  }

  try {
    installFromLocal(localPath);
  } finally {
    if (downloaded) cleanup(downloaded);
  }
}

function installFromLocal(sourcePath: string): void {
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
    tempDir = join(tmpdir(), `dripnex-plugin-install-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    try {
      const name = basename(sourcePath).toLowerCase();
      if (name.endsWith('.tar.gz') || name.endsWith('.tgz')) {
        execFileSync('tar', ['-xzf', sourcePath, '-C', tempDir], { stdio: 'pipe' });
      } else if (name.endsWith('.zip')) {
        execFileSync('unzip', ['-q', sourcePath, '-d', tempDir], { stdio: 'pipe' });
      } else {
        cleanup(tempDir);
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

    const foundRoot = findPluginRoot(tempDir);
    if (!foundRoot) {
      cleanup(tempDir);
      console.error('Error: Could not find a valid manifest.json in the extracted archive.');
      console.error('       The archive must contain a manifest.json with id, name, and version.');
      process.exit(1);
    }
    pluginSourceDir = foundRoot;
  } else {
    console.error('Error: Path must be a directory or archive file.');
    process.exit(1);
  }

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

const REGISTRY_URLS = [
  process.env.DRIPNEX_API_URL,
  'https://api.dripnex.app',
  'https://readied-api-production.readied.workers.dev',
].filter((u): u is string => Boolean(u));

async function resolveRegistryAsset(slug: string): Promise<string> {
  let lastError = 'Registry unreachable';
  for (const base of [...new Set(REGISTRY_URLS)]) {
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/plugins/${encodeURIComponent(slug)}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'dripnex-plugin' },
      });
      if (res.status === 404) {
        lastError = `Package "${slug}" is not in the registry`;
        continue;
      }
      if (!res.ok) {
        lastError = `Registry returned ${res.status}`;
        continue;
      }
      const body = (await res.json()) as { bundleUrl?: string; slug?: string };
      if (body.bundleUrl?.startsWith('https://')) {
        console.log(`Fetching ${slug} from the Dripnex registry`);
        return body.bundleUrl;
      }
      lastError = `Package "${slug}" has no download URL`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  console.error(`Error: ${lastError}`);
  process.exit(1);
}

async function resolveGithubAsset(owner: string, repo: string, tag?: string): Promise<string> {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'dripnex-plugin',
  };

  const candidates = tag
    ? uniqueTags(tag).map(t => `https://api.github.com/repos/${owner}/${repo}/releases/tags/${t}`)
    : [`https://api.github.com/repos/${owner}/${repo}/releases/latest`];

  let lastStatus = 0;
  for (const url of candidates) {
    const res = await fetch(url, { headers });
    lastStatus = res.status;
    if (res.status === 404) continue;
    if (!res.ok) {
      console.error(`Error: GitHub returned ${res.status} for ${owner}/${repo}`);
      process.exit(1);
    }
    const release = (await res.json()) as GithubRelease;
    const asset = (release.assets ?? []).find(a => /\.(tar\.gz|tgz)$/i.test(a.name));
    if (!asset) {
      console.error(
        `Error: Release ${release.tag_name ?? tag ?? 'latest'} of ${owner}/${repo} has no .tar.gz.`
      );
      console.error('       Authors: dripnex-plugin pack && attach the archive to the GitHub release.');
      process.exit(1);
    }
    console.log(`Fetching ${owner}/${repo}@${release.tag_name ?? tag} (${asset.name})`);
    return asset.browser_download_url;
  }

  console.error(
    `Error: No GitHub release found for ${owner}/${repo}${tag ? `@${tag}` : ''} (${lastStatus}).`
  );
  process.exit(1);
}

function uniqueTags(tag: string): string[] {
  const withV = tag.startsWith('v') ? tag : `v${tag}`;
  const withoutV = tag.startsWith('v') ? tag.slice(1) : tag;
  return [...new Set([tag, withV, withoutV])];
}

async function downloadArchive(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'dripnex-plugin' },
    redirect: 'follow',
  });
  if (!res.ok) {
    console.error(`Error: Download failed (${res.status}): ${url}`);
    process.exit(1);
  }
  const dest = join(tmpdir(), `dripnex-plugin-${Date.now()}.tar.gz`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

function findPluginRoot(dir: string): string | null {
  if (readManifest(dir)) return dir;

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

function cleanup(path: string | null): void {
  if (path && existsSync(path)) {
    try {
      rmSync(path, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  }
}
