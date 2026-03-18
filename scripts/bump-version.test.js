import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import { execFileSync } from 'child_process';

const FIXTURES = resolve(import.meta.dirname, '__fixtures__');

describe('bump-version.js', () => {
  beforeEach(() => {
    mkdirSync(join(FIXTURES, 'apps/desktop'), { recursive: true });
    writeFileSync(
      join(FIXTURES, 'package.json'),
      JSON.stringify({ name: 'root', version: '0.9.0' }, null, 2) + '\n'
    );
    writeFileSync(
      join(FIXTURES, 'apps/desktop/package.json'),
      JSON.stringify({ name: 'desktop', version: '0.9.0' }, null, 2) + '\n'
    );
  });

  afterEach(() => {
    rmSync(FIXTURES, { recursive: true, force: true });
  });

  it('updates version in both package.json files', () => {
    execFileSync('node', [resolve(import.meta.dirname, 'bump-version.js'), '1.0.0'], {
      cwd: FIXTURES,
    });

    const root = JSON.parse(readFileSync(join(FIXTURES, 'package.json'), 'utf8'));
    const desktop = JSON.parse(readFileSync(join(FIXTURES, 'apps/desktop/package.json'), 'utf8'));

    expect(root.version).toBe('1.0.0');
    expect(desktop.version).toBe('1.0.0');
  });

  it('exits with error when no version provided', () => {
    expect(() =>
      execFileSync('node', [resolve(import.meta.dirname, 'bump-version.js')], {
        cwd: FIXTURES,
        stdio: 'pipe',
      })
    ).toThrow();
  });
});
