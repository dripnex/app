#!/usr/bin/env node
/**
 * Sync the `version` field across the monorepo's release-relevant
 * package.json files. Called by @semantic-release/exec at the
 * `prepareCmd` step so the @semantic-release/git plugin actually has
 * a diff to commit.
 *
 * Why this script exists (history):
 *
 *   1. semantic-release/git's `assets` list is COMMIT-only — it does
 *      not mutate files. Something else has to bump the versions first.
 *   2. The original scripts/bump-version.js was deleted in the knip
 *      cleanup (#279) under the false assumption nothing referenced it.
 *      release.config.js still had a prepareCmd pointing at it,
 *      so v0.15.0 shipped with both package.json files reading 0.14.0
 *      (visible mismatch in the v0.15.0 tag).
 *   3. PR #289 patched release.config.js by removing the prepareCmd,
 *      which made semantic-release runnable but kept versions stale.
 *   4. This script restores step (1) properly. It's pure ESM, has no
 *      dependencies, and updates ONLY the version field — no other
 *      package.json keys are touched.
 *
 * Usage:
 *
 *   node scripts/bump-version.mjs 0.15.1
 *
 * Fails non-zero if:
 *   - the version arg is missing or empty
 *   - any target file can't be parsed as JSON
 *   - a target file has no `version` field to update
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

/**
 * Files whose `version` should track the desktop release.
 *
 * Keep this list explicit (not a glob) so we never accidentally bump
 * a workspace package that's intentionally on its own version line
 * (e.g. packages/api which deploys on its own cycle to Cloudflare).
 */
const targets = ['package.json', 'apps/desktop/package.json'];

const newVersion = process.argv[2];
if (!newVersion || newVersion.trim().length === 0) {
  console.error('bump-version: missing version argument');
  console.error('usage: node scripts/bump-version.mjs <version>');
  process.exit(1);
}

let bumped = 0;
for (const rel of targets) {
  const abs = resolve(repoRoot, rel);
  const raw = await readFile(abs, 'utf-8');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`bump-version: cannot parse ${rel} as JSON: ${err.message}`);
    process.exit(1);
  }

  if (typeof parsed.version !== 'string') {
    console.error(`bump-version: ${rel} has no version field to update`);
    process.exit(1);
  }

  const old = parsed.version;
  if (old === newVersion) {
    console.log(`bump-version: ${rel} already at ${newVersion}, skipped`);
    continue;
  }

  parsed.version = newVersion;

  // Preserve a trailing newline if the original file had one — Prettier and
  // most editors expect it. Detecting from `raw` keeps the diff minimal.
  const trailingNewline = raw.endsWith('\n') ? '\n' : '';
  await writeFile(abs, JSON.stringify(parsed, null, 2) + trailingNewline, 'utf-8');

  console.log(`bump-version: ${rel} ${old} -> ${newVersion}`);
  bumped++;
}

console.log(`bump-version: updated ${bumped} of ${targets.length} target(s)`);
