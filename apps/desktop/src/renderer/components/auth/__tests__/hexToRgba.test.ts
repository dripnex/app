import { describe, expect, it } from 'vitest';
import { hexToRgba } from '../hexToRgba';

describe('hexToRgba', () => {
  it('expands a six-digit hex accent', () => {
    expect(hexToRgba('#5eead4', 0.25)).toBe('rgba(94, 234, 212, 0.25)');
  });
});
