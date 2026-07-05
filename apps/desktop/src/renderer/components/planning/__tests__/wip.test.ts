import { describe, it, expect } from 'vitest';
import { isOverWipLimit, parseWipLimit } from '../wip';

describe('isOverWipLimit', () => {
  it('is false when no limit is set', () => {
    expect(isOverWipLimit(10, null)).toBe(false);
    expect(isOverWipLimit(10, undefined)).toBe(false);
    expect(isOverWipLimit(10, 0)).toBe(false);
  });

  it('is false at or under the limit', () => {
    expect(isOverWipLimit(3, 3)).toBe(false);
    expect(isOverWipLimit(2, 3)).toBe(false);
  });

  it('is true over the limit', () => {
    expect(isOverWipLimit(4, 3)).toBe(true);
  });
});

describe('parseWipLimit', () => {
  it('parses a positive integer', () => {
    expect(parseWipLimit('5')).toBe(5);
    expect(parseWipLimit('  12 ')).toBe(12);
  });

  it('returns null for empty/zero/negative/non-numeric', () => {
    expect(parseWipLimit('')).toBeNull();
    expect(parseWipLimit('0')).toBeNull();
    expect(parseWipLimit('-3')).toBeNull();
    expect(parseWipLimit('abc')).toBeNull();
  });
});
