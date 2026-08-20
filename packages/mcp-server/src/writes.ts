import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Sidecar next to the DB. Desktop Settings writes this; env still wins. */
export const MCP_WRITES_FILE = 'mcp.json';

export function writesEnabled(dbPath?: string, env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.DRIPNEX_MCP_WRITES === '1') return true;
  if (env.DRIPNEX_MCP_WRITES === '0') return false;
  if (!dbPath) return false;
  try {
    const raw = readFileSync(join(dirname(dbPath), MCP_WRITES_FILE), 'utf8');
    const parsed = JSON.parse(raw) as { writes?: unknown };
    return parsed.writes === true;
  } catch {
    return false;
  }
}

export function writesDisabledMessage(): string {
  return 'Writes are off. Enable them in Dripnex → Settings → Integrations → Allow writes.';
}
