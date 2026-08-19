import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { describe, it, expect, afterEach } from 'vitest';
import { scanPlugins } from '../../pluginScanner';

const ROOT = join(tmpdir(), `dripnex-scan-${Date.now()}`);

afterEach(async () => {
  await rm(ROOT, { recursive: true, force: true });
});

describe('scanPlugins', () => {
  it('loads keymaps, menus, and styles from the plugin package', async () => {
    const dir = join(ROOT, 'hello');
    await mkdir(join(dir, 'keymaps'), { recursive: true });
    await mkdir(join(dir, 'menus'), { recursive: true });
    await mkdir(join(dir, 'styles'), { recursive: true });
    await writeFile(
      join(dir, 'manifest.json'),
      JSON.stringify({
        id: 'hello',
        name: 'Hello',
        version: '1.0.0',
        main: 'index.js',
      })
    );
    await writeFile(join(dir, 'index.js'), 'module.exports = { id: "hello", activate() {} }');
    await writeFile(join(dir, 'keymaps', 'default.json'), '{ "say-hello": "Mod+H" }');
    await writeFile(
      join(dir, 'menus', 'main.json'),
      '{ "menu": [{ "label": "Hello", "command": "say-hello" }] }'
    );
    await writeFile(join(dir, 'styles', 'index.css'), '.hello { color: red; }');

    const scanned = await scanPlugins(ROOT);
    expect(scanned).toHaveLength(1);
    expect(scanned[0]?.id).toBe('hello');
    expect(scanned[0]?.keymaps[0]).toContain('say-hello');
    expect(scanned[0]?.menus[0]).toContain('"label": "Hello"');
    expect(scanned[0]?.styles[0]).toContain('.hello { color: red; }');
  });

  it('loads a theme-only package without main', async () => {
    const dir = join(ROOT, 'paper');
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, 'manifest.json'),
      JSON.stringify({ id: 'paper', name: 'Paper', version: '1.0.0' })
    );
    await writeFile(
      join(dir, 'theme.json'),
      JSON.stringify({
        id: 'paper',
        name: 'Paper',
        colorScheme: 'light',
        tokens: { '--bg-base': '#fff' },
      })
    );

    const scanned = await scanPlugins(ROOT);
    expect(scanned).toHaveLength(1);
    expect(scanned[0]?.id).toBe('paper');
    expect(scanned[0]?.code).toBe('');
    expect(scanned[0]?.themes[0]).toContain('colorScheme');
  });
});
