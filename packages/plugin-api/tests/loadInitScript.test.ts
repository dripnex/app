import { describe, it, expect, vi } from 'vitest';
import { loadInitScript } from '../src/loader/loadInitScript';

function validInitCode(overrides: Record<string, string> = {}): string {
  const id = overrides.id ?? 'my-init';
  const name = overrides.name ?? 'My Init Script';
  const version = overrides.version ?? '1.0.0';
  return `
    module.exports = {
      id: '${id}',
      name: '${name}',
      version: '${version}',
      activate: function(ctx) {},
    };
  `;
}

describe('loadInitScript', () => {
  it('loads a valid init.js script', () => {
    const manifest = loadInitScript(validInitCode());

    expect(manifest).not.toBeNull();
    expect(manifest!.id).toBe('my-init');
    expect(manifest!.name).toBe('My Init Script');
    expect(manifest!.version).toBe('1.0.0');
    expect(typeof manifest!.activate).toBe('function');
  });

  it('allows any valid kebab-case ID (no expected ID check)', () => {
    const manifest = loadInitScript(validInitCode({ id: 'custom-user-script' }));

    expect(manifest).not.toBeNull();
    expect(manifest!.id).toBe('custom-user-script');
  });

  it('returns null for invalid manifest (missing activate)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const code = `
      module.exports = {
        id: 'bad',
        name: 'Bad',
        version: '1.0.0',
      };
    `;

    const result = loadInitScript(code);

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('defers a top-level throw to activate (probe cannot tell free-form from a bomb)', () => {
    const result = loadInitScript('throw new Error("boom");');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('user-init');
    expect(() =>
      result!.activate({
        log: { debug() {}, info() {}, warn() {}, error() {} },
      } as never)
    ).toThrow('boom');
  });

  it('wraps a comment-only file as user-init', () => {
    const result = loadInitScript('// nothing exported');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('user-init');
    expect(result!.name).toBe('init.js');
    expect(typeof result!.activate).toBe('function');
  });

  it('wraps free-form even when preload dripnex exists on globalThis', () => {
    const prev = (globalThis as { dripnex?: unknown }).dripnex;
    (globalThis as { dripnex?: unknown }).dripnex = { notes: {} };
    try {
      const manifest = loadInitScript(`
        dripnex.menu.add({ label: 'Insert Date', click: function () {} });
      `);
      expect(manifest).not.toBeNull();
      expect(manifest!.id).toBe('user-init');
    } finally {
      if (prev === undefined) delete (globalThis as { dripnex?: unknown }).dripnex;
      else (globalThis as { dripnex?: unknown }).dripnex = prev;
    }
  });

  it('wraps a free-form dripnex script as user-init', () => {
    const registerCommand = vi.fn(() => () => {});
    const code = `
      dripnex.commands.add('hello', 'Say Hello', function () {});
    `;

    const manifest = loadInitScript(code);

    expect(manifest).not.toBeNull();
    expect(manifest!.id).toBe('user-init');

    manifest!.activate({
      registerCommand,
      editor: {},
      app: {},
      data: {},
      log: { debug() {}, info() {}, warn() {}, error() {} },
      config: {},
      layout: {},
      decorations: {},
      registerExtensions: vi.fn(),
      registerAiCommand: vi.fn(),
      registerCssVariables: vi.fn(),
      menu: { add: vi.fn(() => () => {}) },
      clipboard: { readText: vi.fn(async () => ''), writeText: vi.fn(async () => {}) },
      registerTheme: vi.fn(),
      registerRemarkPlugin: vi.fn(),
      registerRehypePlugin: vi.fn(),
      registerPreviewComponent: vi.fn(),
      registerCodeBlockRenderer: vi.fn(),
    } as never);

    expect(registerCommand).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'hello', name: 'Say Hello' }),
      expect.any(Function)
    );
  });

  it('returns null for invalid ID format', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const code = `
      module.exports = {
        id: 'NOT_VALID',
        name: 'Bad ID',
        version: '1.0.0',
        activate: function() {},
      };
    `;

    const result = loadInitScript(code);

    expect(result).toBeNull();
    warnSpy.mockRestore();
  });

  it('supports deactivate hook', () => {
    const code = `
      module.exports = {
        id: 'with-deactivate',
        name: 'Deactivate Test',
        version: '1.0.0',
        activate: function(ctx) {},
        deactivate: function() {},
      };
    `;

    const manifest = loadInitScript(code);

    expect(manifest).not.toBeNull();
    expect(typeof manifest!.deactivate).toBe('function');
  });
});
