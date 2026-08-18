/**
 * Node entry: pnpm db:migrate
 * Loads TURSO_* from the environment or .dev.vars / .dev.vars.local.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { runMigrations } from './runMigrations.js';

function loadDevVars(): void {
  for (const name of ['.dev.vars.local', '.dev.vars']) {
    const path = join(process.cwd(), name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq);
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
    break;
  }
}

loadDevVars();

const url = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;
if (!url || url.includes('your-database')) {
  console.error('TURSO_DATABASE_URL is missing or still the placeholder.');
  process.exit(1);
}

const report = await runMigrations({ TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: token ?? '' });
console.log(JSON.stringify(report, null, 2));
