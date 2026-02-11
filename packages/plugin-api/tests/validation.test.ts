import { describe, it, expect, vi } from 'vitest';
import { validateManifest, assertValidManifest } from '../src/validation';
import type { PluginManifest } from '../src/types';

function makeManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    activate: () => {},
    ...overrides,
  };
}

describe('validateManifest', () => {
  it('accepts a valid manifest', () => {
    expect(validateManifest(makeManifest())).toEqual([]);
  });

  it('rejects null', () => {
    const errors = validateManifest(null);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.field).toBe('manifest');
  });

  it('rejects undefined', () => {
    const errors = validateManifest(undefined);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.field).toBe('manifest');
  });

  it('rejects non-object', () => {
    const errors = validateManifest('string');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.field).toBe('manifest');
  });

  // id validation
  it('rejects missing id', () => {
    const errors = validateManifest(makeManifest({ id: '' }));
    expect(errors.some(e => e.field === 'id')).toBe(true);
  });

  it('rejects non-kebab-case id', () => {
    const errors = validateManifest(makeManifest({ id: 'TestPlugin' }));
    expect(errors.some(e => e.field === 'id')).toBe(true);
  });

  it('rejects id with leading hyphen', () => {
    const errors = validateManifest(makeManifest({ id: '-bad-id' }));
    expect(errors.some(e => e.field === 'id')).toBe(true);
  });

  it('accepts kebab-case ids', () => {
    expect(validateManifest(makeManifest({ id: 'my-plugin' }))).toEqual([]);
    expect(validateManifest(makeManifest({ id: 'plugin123' }))).toEqual([]);
    expect(validateManifest(makeManifest({ id: 'a' }))).toEqual([]);
  });

  // name validation
  it('rejects empty name', () => {
    const errors = validateManifest(makeManifest({ name: '   ' }));
    expect(errors.some(e => e.field === 'name')).toBe(true);
  });

  it('rejects non-string name', () => {
    const errors = validateManifest({ ...makeManifest(), name: 42 });
    expect(errors.some(e => e.field === 'name')).toBe(true);
  });

  // version validation
  it('rejects empty version', () => {
    const errors = validateManifest(makeManifest({ version: '' }));
    expect(errors.some(e => e.field === 'version')).toBe(true);
  });

  it('rejects invalid semver', () => {
    const errors = validateManifest(makeManifest({ version: '1.0' }));
    expect(errors.some(e => e.field === 'version')).toBe(true);
  });

  it('accepts valid semver variants', () => {
    expect(validateManifest(makeManifest({ version: '1.0.0' }))).toEqual([]);
    expect(validateManifest(makeManifest({ version: '0.0.1' }))).toEqual([]);
    expect(validateManifest(makeManifest({ version: '2.3.4-beta.1' }))).toEqual([]);
    expect(validateManifest(makeManifest({ version: '1.0.0+build.123' }))).toEqual([]);
  });

  // activate validation
  it('rejects missing activate', () => {
    const m = { id: 'test', name: 'Test', version: '1.0.0' };
    const errors = validateManifest(m);
    expect(errors.some(e => e.field === 'activate')).toBe(true);
  });

  it('rejects non-function activate', () => {
    const m = { ...makeManifest(), activate: 'not-a-function' };
    const errors = validateManifest(m);
    expect(errors.some(e => e.field === 'activate')).toBe(true);
  });

  // deactivate validation
  it('accepts missing deactivate', () => {
    const m = makeManifest();
    delete (m as unknown as Record<string, unknown>).deactivate;
    expect(validateManifest(m)).toEqual([]);
  });

  it('accepts function deactivate', () => {
    expect(validateManifest(makeManifest({ deactivate: () => {} }))).toEqual([]);
  });

  it('rejects non-function deactivate', () => {
    const m = { ...makeManifest(), deactivate: 'bad' };
    const errors = validateManifest(m);
    expect(errors.some(e => e.field === 'deactivate')).toBe(true);
  });

  // multiple errors
  it('reports multiple errors at once', () => {
    const errors = validateManifest({ id: '', name: '', version: '' });
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('assertValidManifest', () => {
  it('returns manifest for valid input', () => {
    const m = makeManifest();
    const result = assertValidManifest(m);
    expect(result).toBe(m);
  });

  it('returns null for invalid input', () => {
    expect(assertValidManifest(null)).toBeNull();
  });

  it('logs errors via provided logger', () => {
    const log = vi.fn();
    assertValidManifest(null, log);
    expect(log).toHaveBeenCalled();
  });

  it('does not log for valid manifest', () => {
    const log = vi.fn();
    assertValidManifest(makeManifest(), log);
    expect(log).not.toHaveBeenCalled();
  });
});
