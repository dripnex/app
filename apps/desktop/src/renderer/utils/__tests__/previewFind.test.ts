import { describe, expect, it } from 'vitest';
import { nextFindIndex } from '../previewFind';

describe('nextFindIndex', () => {
  it('wraps forward and backward', () => {
    expect(nextFindIndex(3, 0, 1)).toBe(1);
    expect(nextFindIndex(3, 2, 1)).toBe(0);
    expect(nextFindIndex(3, 0, -1)).toBe(2);
  });

  it('returns 0 when there are no matches', () => {
    expect(nextFindIndex(0, 4, 1)).toBe(0);
  });
});
