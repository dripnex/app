#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const version = process.argv[2];
if (!version) {
  console.error('Usage: bump-version.js <version>');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error(`Invalid version format: ${version}`);
  process.exit(1);
}

const files = ['package.json', 'apps/desktop/package.json'];

for (const file of files) {
  const path = resolve(file);
  try {
    const pkg = JSON.parse(readFileSync(path, 'utf8'));
    pkg.version = version;
    writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`Updated ${file} -> ${version}`);
  } catch (err) {
    console.error(`Failed to update ${file}: ${err.message}`);
    process.exit(1);
  }
}
