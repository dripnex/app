import { describe, expect, it } from 'vitest';
import { lineAtOffset, offsetInFence, walkSourceLines } from '../sourceScan';

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
});
