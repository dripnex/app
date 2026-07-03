import { describe, it, expect } from 'vitest';
import { computeReorderedIds } from '../reorder';

describe('computeReorderedIds', () => {
  const col = ['a', 'b', 'c', 'd'];

  it('moves a card above a target', () => {
    expect(computeReorderedIds(col, 'd', 'b', 'above')).toEqual(['a', 'd', 'b', 'c']);
  });

  it('moves a card below a target', () => {
    expect(computeReorderedIds(col, 'a', 'c', 'below')).toEqual(['b', 'c', 'a', 'd']);
  });

  it('appends when targetId is null', () => {
    expect(computeReorderedIds(col, 'b', null, 'append')).toEqual(['a', 'c', 'd', 'b']);
  });

  it('handles dragging downward past its own slot (no off-by-one)', () => {
    // 'b' dropped below 'c' should land between c and d, not stay put.
    expect(computeReorderedIds(col, 'b', 'c', 'below')).toEqual(['a', 'c', 'b', 'd']);
  });

  it('is a no-op position when dropped above itself', () => {
    expect(computeReorderedIds(col, 'b', 'b', 'above')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('adds a card from another column at a position', () => {
    expect(computeReorderedIds(col, 'x', 'a', 'above')).toEqual(['x', 'a', 'b', 'c', 'd']);
  });

  it('appends an unknown target to the end', () => {
    expect(computeReorderedIds(col, 'a', 'zzz', 'below')).toEqual(['b', 'c', 'd', 'a']);
  });
});
