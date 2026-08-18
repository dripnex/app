import { existsSync } from 'fs';
import { readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { describe, it, expect, afterEach } from 'vitest';
import { initPlugin } from '../src/commands/init';

const TEST_DIR = join(tmpdir(), `dripnex-plugin-test-${Date.now()}`);

function testDir(name: string): string {
  return join(TEST_DIR, name);
}

afterEach(async () => {
  // Clean up test artifacts
  if (existsSync(TEST_DIR)) {
    await rm(TEST_DIR, { recursive: true, force: true });
  }
});

describe('initPlugin', () => {
  it('scaffolds a plugin project with correct structure', async () => {
    const dir = await initPlugin({ name: 'Hello World', dir: testDir('hello-world') });

    expect(existsSync(join(dir, 'manifest.json'))).toBe(true);
    expect(existsSync(join(dir, 'package.json'))).toBe(true);
    expect(existsSync(join(dir, 'tsconfig.json'))).toBe(true);
    expect(existsSync(join(dir, 'src', 'index.ts'))).toBe(true);
  });

  it('generates valid manifest.json', async () => {
    const dir = await initPlugin({ name: 'My Plugin', dir: testDir('my-plugin') });
    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf-8'));

    expect(manifest.id).toBe('my-plugin');
    expect(manifest.name).toBe('My Plugin');
    expect(manifest.version).toBe('0.1.0');
    expect(manifest.main).toBe('dist/index.js');
  });

  it('generates valid package.json', async () => {
    const dir = await initPlugin({ name: 'Test Plugin', dir: testDir('test-plugin') });
    const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf-8'));

    expect(pkg.name).toBe('dripnex-plugin-test-plugin');
    expect(pkg.scripts.build).toBe('tsc');
  });

  it('generates index.ts with correct id', async () => {
    const dir = await initPlugin({ name: 'Demo', dir: testDir('demo') });
    const index = await readFile(join(dir, 'src', 'index.ts'), 'utf-8');

    expect(index).toContain("id: 'demo'");
    expect(index).toContain("name: 'Demo'");
    expect(index).toContain('module.exports');
    expect(index).toContain('context.menu.add');
  });

  it('throws if directory already exists', async () => {
    const dir = testDir('existing');
    await initPlugin({ name: 'Existing', dir });

    await expect(initPlugin({ name: 'Existing', dir })).rejects.toThrow('Directory already exists');
  });

  it('throws for empty name', async () => {
    await expect(initPlugin({ name: '', dir: testDir('empty') })).rejects.toThrow(
      'Plugin name is required'
    );
  });

  it('converts name to kebab-case id', async () => {
    const dir = await initPlugin({ name: 'My  Cool  Plugin!', dir: testDir('kebab') });
    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf-8'));

    expect(manifest.id).toBe('my-cool-plugin');
  });
});
