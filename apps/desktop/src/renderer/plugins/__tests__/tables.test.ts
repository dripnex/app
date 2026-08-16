import { describe, it, expect } from 'vitest';
import { findTableRanges } from '../tables';

describe('findTableRanges', () => {
  it('finds a GFM table and ignores surrounding prose', () => {
    const doc = ['# Title', '', '| A | B |', '| --- | --- |', '| 1 | 2 |', '', 'after'].join('\n');

    const ranges = findTableRanges(doc);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]?.text).toContain('| A | B |');
    expect(ranges[0]?.text).toContain('| 1 | 2 |');
  });

  it('returns no ranges when there is no table', () => {
    expect(findTableRanges('# just a heading\n\nparagraph')).toEqual([]);
  });
});
