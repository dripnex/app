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

  it('returns null for code that throws', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = loadInitScript('throw new Error("boom");');

    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('returns null for empty exports', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = loadInitScript('// nothing exported');

    expect(result).toBeNull();
    warnSpy.mockRestore();
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
