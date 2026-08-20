import { describe, expect, it } from 'vitest';
import { findTableAtCursor, findTableRanges, parseGfmTable, tableToCsv } from '../src/index.js';
import { generateGfmTable } from '../src/generate.js';

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

describe('parseGfmTable', () => {
  it('reads alignment markers', () => {
    const text = ['| L | C | R |', '| :--- | :---: | ---: |', '| a | b | c |'].join('\n');
    const table = parseGfmTable(text, 0);
    expect(table?.alignments).toEqual(['left', 'center', 'right']);
    expect(table?.rows).toEqual([['a', 'b', 'c']]);
  });
});

describe('findTableAtCursor', () => {
  it('returns the table covering the cursor', () => {
    const doc = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\noutside';
    expect(findTableAtCursor(doc, 10)?.headers).toEqual(['A', 'B']);
    expect(findTableAtCursor(doc, doc.length - 1)).toBeNull();
  });
});

describe('generateGfmTable / tableToCsv', () => {
  it('builds an empty grid', () => {
    const md = generateGfmTable(2, 3);
    expect(md.split('\n')).toHaveLength(4);
    expect(md).toContain('Column 1');
  });

  it('escapes CSV cells', () => {
    const csv = tableToCsv({
      headers: ['a,b', 'ok'],
      alignments: ['none', 'none'],
      rows: [['say "hi"', '2']],
      from: 0,
      to: 1,
      text: '',
    });
    expect(csv).toBe('"a,b",ok\n"say ""hi""",2');
  });
});
