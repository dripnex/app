import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shell } from 'electron';
import { loadInitScript } from '@dripnex/plugin-api';
import {
  INIT_JS_TEMPLATE,
  OPEN_USER_FILE_CHANNEL,
  USER_HACK_KINDS,
  USER_INIT_FILE,
  USER_KEYMAP_FILE,
  USER_STYLES_FILE,
  ensureUserHackFiles,
  openUserHackFile,
} from '../userHackFiles.js';

function liveSource(source: string): string {
  return source
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('//');
    })
    .join('\n');
}

describe('INIT_JS_TEMPLATE', () => {
  it('registers Make this sendable via dripnex.registerAiCommand', () => {
    expect(INIT_JS_TEMPLATE).toContain('registerAiCommand');
    expect(INIT_JS_TEMPLATE).toContain('Make this sendable');

    const live = liveSource(INIT_JS_TEMPLATE);
    expect(live).toContain('dripnex.registerAiCommand');
    expect(live).toContain("name: 'Make this sendable'");
    expect(live).toContain('{{selection}}');
    expect(live).toContain('{{note}}');
    expect(live).not.toContain('Insert Date');
    expect(live).not.toContain('dripnex.menu.add');
  });

  it('keeps dripnex.commands.add as a short commented example', () => {
    expect(INIT_JS_TEMPLATE).toContain('dripnex.commands.add');
  });

  it('loads as free-form init.js and calls registerAiCommand', () => {
    const registerAiCommand = vi.fn(() => () => {});
    const manifest = loadInitScript(INIT_JS_TEMPLATE);
    expect(manifest).not.toBeNull();
    expect(manifest!.id).toBe('user-init');

    manifest!.activate({
      registerAiCommand,
      registerCommand: vi.fn(() => () => {}),
      editor: { insertAtCursor: vi.fn(), getView: vi.fn() },
      log: { debug() {}, info() {}, warn() {}, error() {} },
    } as never);

    expect(registerAiCommand).toHaveBeenCalledTimes(1);
    expect(registerAiCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'make-this-sendable',
        name: 'Make this sendable',
        userPromptTemplate: expect.stringContaining('{{selection}}'),
        outputTarget: 'replace',
      })
    );
  });
});

describe('ensureUserHackFiles / openUserHackFile', () => {
  let dataRoot: string;
  const openPath = vi.spyOn(shell, 'openPath');

  beforeEach(async () => {
    dataRoot = await mkdtemp(join(tmpdir(), 'dripnex-hack-'));
    openPath.mockReset();
    openPath.mockResolvedValue('');
  });

  afterEach(async () => {
    await rm(dataRoot, { recursive: true, force: true });
  });

  it('writes templates on first launch and does not overwrite existing init.js', async () => {
    await ensureUserHackFiles(dataRoot);

    const initPath = join(dataRoot, USER_INIT_FILE);
    const stylesPath = join(dataRoot, USER_STYLES_FILE);
    const keymapPath = join(dataRoot, USER_KEYMAP_FILE);

    expect(await readFile(initPath, 'utf-8')).toBe(INIT_JS_TEMPLATE);
    expect(await readFile(stylesPath, 'utf-8')).toContain('--accent');
    expect(await readFile(keymapPath, 'utf-8')).toContain('app:next-note');

    await writeFile(initPath, '// mine\n', 'utf-8');
    await ensureUserHackFiles(dataRoot);
    expect(await readFile(initPath, 'utf-8')).toBe('// mine\n');
  });

  it('creates a missing file from the template then opens it', async () => {
    const result = await openUserHackFile(dataRoot, 'init');
    expect(result).toEqual({ success: true, path: join(dataRoot, USER_INIT_FILE) });
    expect(await readFile(join(dataRoot, USER_INIT_FILE), 'utf-8')).toBe(INIT_JS_TEMPLATE);
    expect(openPath).toHaveBeenCalledWith(join(dataRoot, USER_INIT_FILE));
  });

  it('does not overwrite an existing file when opening', async () => {
    const initPath = join(dataRoot, USER_INIT_FILE);
    await writeFile(initPath, 'dripnex.commands.add("keep", "Keep", () => {});', 'utf-8');

    const result = await openUserHackFile(dataRoot, 'init');
    expect(result.success).toBe(true);
    expect(await readFile(initPath, 'utf-8')).toBe(
      'dripnex.commands.add("keep", "Keep", () => {});'
    );
    expect(openPath).toHaveBeenCalledWith(initPath);
  });

  it('opens styles and keymap through the same path', async () => {
    await expect(openUserHackFile(dataRoot, 'styles')).resolves.toEqual({
      success: true,
      path: join(dataRoot, USER_STYLES_FILE),
    });
    await expect(openUserHackFile(dataRoot, 'keymap')).resolves.toEqual({
      success: true,
      path: join(dataRoot, USER_KEYMAP_FILE),
    });
    expect(openPath).toHaveBeenCalledWith(join(dataRoot, USER_STYLES_FILE));
    expect(openPath).toHaveBeenCalledWith(join(dataRoot, USER_KEYMAP_FILE));
  });
});

describe('open-file IPC contract', () => {
  it('keeps plugins:openUserFile as the channel and kinds', () => {
    expect(OPEN_USER_FILE_CHANNEL).toBe('plugins:openUserFile');
    expect(USER_HACK_KINDS).toEqual(['init', 'styles', 'keymap']);
  });
});
