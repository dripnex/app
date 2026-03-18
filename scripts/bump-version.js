#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const version = process.argv[2];
if (!version) {
  console.error('Usage: bump-version.js <version>');
  process.exit(1);
}

const files = ['package.json', 'apps/desktop/package.json'];

for (const file of files) {
  const path = resolve(file);
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  pkg.version = version;
  writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Updated ${file} -> ${version}`);
}
