import { describe, expect, it } from 'vitest';
import { extractHeadings, findHeadingByAnchor } from '../src/core/headings.js';

describe('extractHeadings', () => {
  it('skips headings inside fenced code', () => {
    const md = ['# Real', '```md', '# Fake', '```', '## Also real'].join('\n');
    expect(extractHeadings(md).map(h => h.text)).toEqual(['Real', 'Also real']);
  });

  it('strips closing hashes', () => {
    expect(extractHeadings('### Done ###')).toEqual([
      { text: 'Done', level: 3, slug: 'done' },
    ]);
  });
});

describe('findHeadingByAnchor', () => {
  it('matches slug and ignores fenced headings', () => {
    const md = ['# Real Title', '```', '# Fake Title', '```'].join('\n');
    expect(findHeadingByAnchor(md, 'real-title')?.text).toBe('Real Title');
    expect(findHeadingByAnchor(md, 'Fake Title')).toBeUndefined();
  });
});
