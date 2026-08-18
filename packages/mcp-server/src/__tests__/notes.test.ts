import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  extractTitle,
  markExternalWrite,
  readPackageVersion,
} from '../notes';

describe('mcp note helpers', () => {
  it('uses the same top-of-doc title rule as the app', () => {
    expect(extractTitle('# Hello\n\nBody')).toBe('Hello');
    expect(extractTitle('Intro\n\n# Not the title')).toBe('Intro');
  });

  it('reads version from package.json', () => {
    expect(readPackageVersion(join(import.meta.dirname, '../..'))).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('writes an external-write signal next to the db', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dripnex-mcp-'));
    try {
      markExternalWrite(join(dir, 'dripnex.db'));
      const raw = readFileSync(join(dir, 'dripnex.external-write'), 'utf8');
      expect(Number(raw)).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
