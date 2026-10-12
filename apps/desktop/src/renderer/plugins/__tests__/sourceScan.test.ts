import { describe, expect, it } from 'vitest';
import {
  inlineCodeSpans,
  lineAtOffset,
  maskInlineCode,
  offsetInFence,
  walkSourceLines,
} from '../sourceScan';

describe('walkSourceLines', () => {
  it('keeps CRLF widths so the second line starts after both bytes', () => {
    const md = 'one\r\ntwo';
    const rows = walkSourceLines(md);
    expect(rows.map(r => ({ line: r.line, from: r.from, to: r.to, nextFrom: r.nextFrom }))).toEqual(
      [
        { line: 'one', from: 0, to: 3, nextFrom: 5 },
        { line: 'two', from: 5, to: 8, nextFrom: 8 },
      ]
    );
    expect(lineAtOffset(md, 3)?.line).toBe('one');
    expect(lineAtOffset(md, 4)?.line).toBe('one');
    expect(lineAtOffset(md, 5)?.line).toBe('two');
  });

  it('does not close a backtick fence with a shorter or tilde marker', () => {
    const md = '```\ncode\n``\n~~~\nstill\n```\nafter';
    expect(offsetInFence(md, md.indexOf('still'))).toBe(true);
    expect(offsetInFence(md, md.indexOf('after'))).toBe(false);
    const openers = walkSourceLines(md)
      .filter(r => r.isFenceOpener)
      .map(r => r.line);
    const closers = walkSourceLines(md)
      .filter(r => r.isFenceCloser)
      .map(r => r.line);
    expect(openers).toEqual(['```']);
    expect(closers).toEqual(['```']);
  });

  it('treats the fence marker line as in-fence', () => {
    const md = '```\nhi\n```';
    expect(offsetInFence(md, 0)).toBe(true);
    expect(offsetInFence(md, md.indexOf('hi'))).toBe(true);
    expect(offsetInFence(md, md.lastIndexOf('```'))).toBe(true);
  });

  it('does not close a fence when non-whitespace follows the closer marker', () => {
    const md = '```\n```ts\nstill\n```\nafter';
    expect(offsetInFence(md, md.indexOf('still'))).toBe(true);
    expect(offsetInFence(md, md.indexOf('after'))).toBe(false);
    expect(
      walkSourceLines(md)
        .filter(r => r.isFenceCloser)
        .map(r => r.line)
    ).toEqual(['```']);
  });
});

describe('inlineCodeSpans', () => {
  it('pairs delimiter runs of the same length', () => {
    const inner = 'literal `' + ' #tag';
    const line = 'See ``' + inner + '`` end';
    expect(inlineCodeSpans(line)).toEqual([
      { from: 4, to: 4 + 2 + inner.length + 2, innerFrom: 6, innerTo: 6 + inner.length },
    ]);
    expect(maskInlineCode(line)).toBe('See ' + ' '.repeat(2 + inner.length + 2) + ' end');
    expect(inlineCodeSpans('See `cat`')).toEqual([{ from: 4, to: 9, innerFrom: 5, innerTo: 8 }]);
  });

  it('pairs delimiter runs across a line ending', () => {
    const md = 'See `literal\n#tag` after';
    expect(inlineCodeSpans(md)).toEqual([{ from: 4, to: 18, innerFrom: 5, innerTo: 17 }]);
    expect(maskInlineCode(md).slice(md.indexOf('#tag'), md.indexOf('#tag') + 4)).toBe('    ');
  });
});
