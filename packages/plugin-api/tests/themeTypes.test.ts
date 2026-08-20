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
    expect(isValidThemeToken('--cm-heading')).toBe(true);
    expect(isValidThemeToken('--md-list-mark-2-color')).toBe(true);
    expect(isValidThemeToken('--mde-preview-list-marker-3-color')).toBe(true);
  });

  it('rejects unknown tokens', () => {
    expect(isValidThemeToken('--custom-thing')).toBe(false);
    expect(isValidThemeToken('--accent')).toBe(true);
    expect(isValidThemeToken('--accent-primary')).toBe(true);
    expect(isValidThemeToken('color')).toBe(false);
    expect(isValidThemeToken('--font-sans')).toBe(false);
  });
});

describe('validateThemeTokens', () => {
  it('returns only valid tokens', () => {
    const result = validateThemeTokens(
      {
        '--bg-base': '#000',
        '--text-primary': '#fff',
        '--invalid-token': 'red',
        '--syntax-keyword': '#f0f',
      },
      'test-theme'
    );

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

  it('owns --accent-primary when the palette only sets --accent', () => {
    const result = validateThemeTokens({ '--accent': '#7dd3fc', '--bg-base': '#000' }, 'glass');
    expect(result['--accent-primary']).toBe('#7dd3fc');
  });

  it('keeps an explicit --accent-primary', () => {
    const result = validateThemeTokens(
      { '--accent': '#7dd3fc', '--accent-primary': '#38bdf8' },
      'glass'
    );
    expect(result['--accent-primary']).toBe('#38bdf8');
  });
});
