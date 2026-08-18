/* eslint-disable no-console */

import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { readManifest } from '../utils';

/**
 * Pack a plugin directory into <id>-<version>.tar.gz next to it.
 * The archive is what a GitHub Release should attach.
 */
export function packPlugin(source: string): string {
  const sourcePath = resolve(source);
  const manifest = readManifest(sourcePath);
  if (!manifest) {
    console.error('Error: No valid manifest.json in', sourcePath);
    process.exit(1);
  }

  const main = manifest.main ?? 'dist/index.js';
  if (!existsSync(join(sourcePath, main))) {
    console.error(`Error: ${main} is missing. Build the plugin first.`);
    process.exit(1);
  }

  const archive = `${manifest.id}-${manifest.version}.tar.gz`;
  const dest = join(process.cwd(), archive);
  const members = ['manifest.json'];
  if (existsSync(join(sourcePath, 'dist'))) members.push('dist');
  else members.push(main);

  execFileSync('tar', ['-czf', dest, '-C', sourcePath, ...members], { stdio: 'inherit' });

  console.log(`Packed ${manifest.name} ${manifest.version}`);
  console.log(`  ${dest}`);
  return dest;
}

export function printPublishHelp(source: string): void {
  const sourcePath = resolve(source);
  const manifest = readManifest(sourcePath);
  if (!manifest) {
    console.error('Error: No valid manifest.json in', sourcePath);
    process.exit(1);
  }
  const archive = packPlugin(sourcePath);
  const tag = `v${manifest.version}`;
  console.log('');
  console.log('A community plugin is its own git repo. Publish a GitHub release:');
  console.log('');
  console.log(`  git tag ${tag}`);
  console.log(`  git push origin ${tag}`);
  console.log(`  gh release create ${tag} ${archive} --title "${manifest.name} ${manifest.version}"`);
  console.log('');
  console.log('Then register it in the catalog with:');
  console.log(`  slug: ${manifest.id}`);
  console.log(`  version: ${manifest.version}`);
  console.log(`  repository: <owner>/<repo>`);
  console.log(
    `  bundleUrl: https://github.com/<owner>/<repo>/releases/download/${tag}/${manifest.id}-${manifest.version}.tar.gz`
  );
}
