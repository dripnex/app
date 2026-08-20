import { describe, expect, it } from 'vitest';
import { scaleCssAlpha, withCssAlpha } from '../colorUtils';

describe('scaleCssAlpha', () => {
  it('scales rgba alpha', () => {
    expect(scaleCssAlpha('rgba(10, 11, 16, 0.4)', 0.5)).toBe('rgba(10, 11, 16, 0.2)');
  });

  it('turns hex into rgba', () => {
    expect(scaleCssAlpha('#0a0b0d', 0.5)).toBe('rgba(10, 11, 13, 0.500)');
  });
});

describe('withCssAlpha', () => {
  it('replaces rgba alpha', () => {
    expect(withCssAlpha('rgba(10, 11, 16, 0.2)', 0.96)).toBe('rgba(10, 11, 16, 0.96)');
  });
});
