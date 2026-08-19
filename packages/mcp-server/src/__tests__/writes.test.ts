import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MCP_WRITES_FILE, writesEnabled } from '../writes';

describe('writesEnabled', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function dbInTmp(writes?: boolean): string {
    const dir = mkdtempSync(join(tmpdir(), 'dripnex-mcp-writes-'));
    dirs.push(dir);
    if (writes !== undefined) {
      writeFileSync(join(dir, MCP_WRITES_FILE), JSON.stringify({ writes }));
    }
    return join(dir, 'dripnex.db');
  }

  it('defaults to off with no env and no sidecar', () => {
    expect(writesEnabled(dbInTmp(), {})).toBe(false);
    expect(writesEnabled(undefined, {})).toBe(false);
  });

  it('reads the sidecar next to the database', () => {
    expect(writesEnabled(dbInTmp(true), {})).toBe(true);
    expect(writesEnabled(dbInTmp(false), {})).toBe(false);
  });

  it('lets the env override the sidecar', () => {
    const dbPath = dbInTmp(false);
    expect(writesEnabled(dbPath, { DRIPNEX_MCP_WRITES: '1' })).toBe(true);
    expect(writesEnabled(dbInTmp(true), { DRIPNEX_MCP_WRITES: '0' })).toBe(false);
  });
});
