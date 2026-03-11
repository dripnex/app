import { describe, it, expect } from 'vitest';
import { isValidThemeToken, validateThemeTokens } from '../src/theme/themeTypes';

describe('isValidThemeToken', () => {
  it('accepts core tokens', () => {
    expect(isValidThemeToken('--bg-base')).toBe(true);
    expect(isValidThemeToken('--text-primary')).toBe(true);
    expect(isValidThemeToken('--danger')).toBe(true);
    expect(isValidThemeToken('--status-active')).toBe(true);
  });

  it('accepts extension scope tokens', () => {
    expect(isValidThemeToken('--syntax-keyword')).toBe(true);
    expect(isValidThemeToken('--preview-heading-color')).toBe(true);
    expect(isValidThemeToken('--ui-sidebar-bg')).toBe(true);
  });

  it('rejects unknown tokens', () => {
    expect(isValidThemeToken('--custom-thing')).toBe(false);
    expect(isValidThemeToken('--accent')).toBe(false);
    expect(isValidThemeToken('color')).toBe(false);
    expect(isValidThemeToken('--font-sans')).toBe(false);
  });
});

describe('validateThemeTokens', () => {
  it('returns only valid tokens', () => {
    const result = validateThemeTokens({
      '--bg-base': '#000',
      '--text-primary': '#fff',
      '--invalid-token': 'red',
      '--syntax-keyword': '#f0f',
    }, 'test-theme');

    expect(result).toEqual({
      '--bg-base': '#000',
      '--text-primary': '#fff',
      '--syntax-keyword': '#f0f',
    });
  });

  it('returns empty object for all-invalid tokens', () => {
    const result = validateThemeTokens({ '--nope': 'red' }, 'test-theme');
    expect(result).toEqual({});
  });
});
