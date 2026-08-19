import { describe, expect, it } from 'vitest';
import {
  extractHeadings,
  filterHeadings,
  findHeadingByAnchor,
  splitWikilinkQuery,
} from '../src/core/headings.js';

describe('extractHeadings', () => {
  it('skips headings inside fenced code', () => {
    const md = ['# Real', '```md', '# Fake', '```', '## Also real'].join('\n');
    expect(extractHeadings(md).map(h => h.text)).toEqual(['Real', 'Also real']);
  });

  it('strips closing hashes', () => {
    expect(extractHeadings('### Done ###')).toEqual([{ text: 'Done', level: 3, slug: 'done' }]);
  });
});

describe('findHeadingByAnchor', () => {
  it('matches slug and ignores fenced headings', () => {
    const md = ['# Real Title', '```', '# Fake Title', '```'].join('\n');
    expect(findHeadingByAnchor(md, 'real-title')?.text).toBe('Real Title');
    expect(findHeadingByAnchor(md, 'Fake Title')).toBeUndefined();
  });
});

describe('splitWikilinkQuery', () => {
  it('splits title and heading, including empty title', () => {
    expect(splitWikilinkQuery('Note#Set')).toEqual({ title: 'Note', heading: 'Set' });
    expect(splitWikilinkQuery('#Set')).toEqual({ title: '', heading: 'Set' });
    expect(splitWikilinkQuery('Note')).toBeNull();
  });
});

describe('filterHeadings', () => {
  const headings = extractHeadings('# Title\n\n## Setup\n\n## Hello World\n');

  it('filters by text or slug', () => {
    expect(filterHeadings(headings, '').map(h => h.text)).toEqual([
      'Title',
      'Setup',
      'Hello World',
    ]);
    expect(filterHeadings(headings, 'hello').map(h => h.text)).toEqual(['Hello World']);
    expect(filterHeadings(headings, 'set').map(h => h.text)).toEqual(['Setup']);
  });
});
