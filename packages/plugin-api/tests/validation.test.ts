import { describe, it, expect, vi } from 'vitest';
import { validateManifest, assertValidManifest, validateConfigValue } from '../src/validation';
import type { PluginManifest, PluginConfigSchemaField } from '../src/types';

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

describe('validateConfigValue', () => {
  // Boolean
  it('accepts valid boolean', () => {
    const field: PluginConfigSchemaField = { type: 'boolean', default: false };
    expect(validateConfigValue(field, true)).toEqual({ valid: true });
  });

  it('rejects non-boolean for boolean field', () => {
    const field: PluginConfigSchemaField = { type: 'boolean', default: false };
    const result = validateConfigValue(field, 'yes');
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  // String
  it('accepts valid string', () => {
    const field: PluginConfigSchemaField = { type: 'string', default: '' };
    expect(validateConfigValue(field, 'hello')).toEqual({ valid: true });
  });

  it('rejects non-string for string field', () => {
    const field: PluginConfigSchemaField = { type: 'string', default: '' };
    const result = validateConfigValue(field, 42);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  // Number
  it('accepts valid number', () => {
    const field: PluginConfigSchemaField = { type: 'number', default: 0 };
    expect(validateConfigValue(field, 5)).toEqual({ valid: true });
  });

  it('rejects non-number for number field', () => {
    const field: PluginConfigSchemaField = { type: 'number', default: 0 };
    const result = validateConfigValue(field, 'five');
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('rejects number below min', () => {
    const field: PluginConfigSchemaField = { type: 'number', default: 5, min: 0 };
    const result = validateConfigValue(field, -1);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('rejects number above max', () => {
    const field: PluginConfigSchemaField = { type: 'number', default: 5, max: 10 };
    const result = validateConfigValue(field, 11);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  // Enum
  it('accepts valid enum value', () => {
    const field: PluginConfigSchemaField = {
      type: 'enum',
      default: 'a',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    };
    expect(validateConfigValue(field, 'a')).toEqual({ valid: true });
  });

  it('rejects invalid enum value', () => {
    const field: PluginConfigSchemaField = {
      type: 'enum',
      default: 'a',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    };
    const result = validateConfigValue(field, 'c');
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('rejects enum with no options defined', () => {
    const field: PluginConfigSchemaField = { type: 'enum', default: 'a' };
    const result = validateConfigValue(field, 'a');
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  // Range
  it('accepts valid range value', () => {
    const field: PluginConfigSchemaField = { type: 'range', default: 5, min: 0, max: 10 };
    expect(validateConfigValue(field, 5)).toEqual({ valid: true });
  });

  it('rejects range below min', () => {
    const field: PluginConfigSchemaField = { type: 'range', default: 5, min: 0, max: 10 };
    const result = validateConfigValue(field, -1);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('rejects range above max', () => {
    const field: PluginConfigSchemaField = { type: 'range', default: 5, min: 0, max: 10 };
    const result = validateConfigValue(field, 11);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('rejects non-number for range field', () => {
    const field: PluginConfigSchemaField = { type: 'range', default: 5, min: 0, max: 10 };
    const result = validateConfigValue(field, 'five');
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });
});
