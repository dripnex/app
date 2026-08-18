/* eslint-disable no-console */

import { existsSync, readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { resolve, join } from 'path';
import { readManifest } from '../utils';
import { packPlugin } from './pack';

const REGISTRY_URL =
  process.env.DRIPNEX_API_URL?.replace(/\/$/, '') || 'https://api.dripnex.app';

interface PublishManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
}

function githubOrigin(cwd: string): string | null {
  try {
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const match = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/i);
    if (!match) return null;
    return `https://github.com/${match[1]}/${match[2]}`;
  } catch {
    return null;
  }
}

function tryGithubRelease(cwd: string, archive: string, manifest: PublishManifest): string | null {
  const repo = githubOrigin(cwd);
  if (!repo) return null;
  const tag = `v${manifest.version}`;
  try {
    execFileSync('gh', ['release', 'view', tag], {
      cwd,
      stdio: 'ignore',
    });
  } catch {
    try {
      execFileSync(
        'gh',
        [
          'release',
          'create',
          tag,
          archive,
          '--title',
          `${manifest.name} ${manifest.version}`,
          '--notes',
          manifest.description || `${manifest.name} ${manifest.version}`,
        ],
        { cwd, stdio: 'inherit' }
      );
    } catch {
      return null;
    }
  }
  const file = archive.split(/[/\\]/).pop();
  return `${repo}/releases/download/${tag}/${file}`;
}

/**
 * Pack the plugin, attach a GitHub release when `gh` is available, then
 * register the version on api.dripnex.app (Inkdrop's `ipm publish`).
 */
export async function publishPlugin(source: string): Promise<void> {
  const sourcePath = resolve(source);
  const manifest = readManifest(sourcePath) as PublishManifest | null;
  if (!manifest) {
    console.error('Error: No valid manifest.json in', sourcePath);
    process.exit(1);
  }

  const archive = packPlugin(sourcePath);
  let bundleUrl = tryGithubRelease(sourcePath, archive, manifest);

  if (!bundleUrl) {
    const repo = githubOrigin(sourcePath);
    console.log('');
    console.log('Could not create a GitHub release automatically.');
    if (repo) {
      const tag = `v${manifest.version}`;
      console.log('Create one, then re-run publish:');
      console.log(`  git tag ${tag} && git push origin ${tag}`);
      console.log(
        `  gh release create ${tag} ${archive} --title "${manifest.name} ${manifest.version}"`
      );
    }
  }

  const token = process.env.DRIPNEX_TOKEN;
  if (!token) {
    console.log('');
    console.log('Registry: set DRIPNEX_TOKEN (desktop JWT) to register the package by name.');
    console.log(`  DRIPNEX_TOKEN=… dripnex-plugin publish ${sourcePath}`);
    if (bundleUrl) {
      console.log(`Tarball is at ${bundleUrl}`);
    }
    return;
  }

  if (!bundleUrl) {
    console.error('Error: need a public HTTPS tarball (GitHub release) to publish.');
    process.exit(1);
  }

  const readmePath = join(sourcePath, 'README.md');
  const readme = existsSync(readmePath) ? readFileSync(readmePath, 'utf8').slice(0, 80_000) : undefined;

  const res = await fetch(`${REGISTRY_URL}/plugins`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'dripnex-plugin',
    },
    body: JSON.stringify({
      slug: manifest.id,
      name: manifest.name,
      description: manifest.description ?? '',
      version: manifest.version,
      bundleUrl,
      repositoryUrl: githubOrigin(sourcePath) ?? undefined,
      readme,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Error: registry returned ${res.status}: ${text}`);
    process.exit(1);
  }

  const body = (await res.json()) as { slug: string; version: string };
  console.log('');
  console.log(`Published ${body.slug}@${body.version}`);
  console.log(`  Install: dripnex-plugin install ${body.slug}`);
  console.log('  Or Settings → Plugins → Browse → Install');
}
