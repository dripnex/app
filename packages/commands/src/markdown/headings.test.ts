import { describe, expect, it } from 'vitest';
import { extractHeadings } from './headings';

describe('extractHeadings', () => {
  it('finds ATX headings with 1-indexed lines', () => {
    const md = ['# Title', '', '## Section', 'body', '### Deep'].join('\n');
    expect(extractHeadings(md)).toEqual([
      { level: 1, text: 'Title', line: 1 },
      { level: 2, text: 'Section', line: 3 },
      { level: 3, text: 'Deep', line: 5 },
    ]);
  });

  it('skips headings inside fenced code', () => {
    const md = ['# Real', '```md', '# Fake', '```', '## Also real'].join('\n');
    expect(extractHeadings(md)).toEqual([
      { level: 1, text: 'Real', line: 1 },
      { level: 2, text: 'Also real', line: 5 },
    ]);
  });

  it('ignores empty hashes and closing hashes', () => {
    const md = ['#', '##   ', '### Done ###'].join('\n');
    expect(extractHeadings(md)).toEqual([{ level: 3, text: 'Done', line: 3 }]);
  });

  it('returns empty for a note without headings', () => {
    expect(extractHeadings('just a paragraph')).toEqual([]);
  });
});
