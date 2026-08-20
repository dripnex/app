import { describe, expect, it } from 'vitest';
import { neighborId } from '../../utils/neighborId';

describe('neighborId', () => {
  const ids = ['a', 'b', 'c'];

  it('moves forward and backward', () => {
    expect(neighborId(ids, 'b', 1)).toBe('c');
    expect(neighborId(ids, 'b', -1)).toBe('a');
  });

  it('stops at the ends', () => {
    expect(neighborId(ids, 'c', 1)).toBeNull();
    expect(neighborId(ids, 'a', -1)).toBeNull();
  });

  it('picks an end when nothing is selected', () => {
    expect(neighborId(ids, null, 1)).toBe('a');
    expect(neighborId(ids, null, -1)).toBe('c');
  });

  it('returns null for an empty list', () => {
    expect(neighborId([], 'a', 1)).toBeNull();
  });
});
