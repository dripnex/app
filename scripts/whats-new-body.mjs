#!/usr/bin/env node
/**
 * Print the What's New markdown for a version, without YAML frontmatter.
 * Empty stdout if the file is missing — callers treat that as "keep the
 * engineering notes semantic-release already wrote".
 *
 *   node scripts/whats-new-body.mjs 0.16.0
 */

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const version = process.argv[2];
if (!version) process.exit(0);

const file = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'releases', `v${version}.md`);

let raw;
try {
  raw = await readFile(file, 'utf8');
} catch {
  process.exit(0);
}

const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
if (body) process.stdout.write(`${body}\n`);
