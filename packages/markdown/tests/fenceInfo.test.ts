import { describe, expect, it } from 'vitest';
import { parseFenceInfo } from '../src/fenceInfo.js';

const none = { startLine: null, highlight: null };

describe('parseFenceInfo', () => {
  it('reads a bare language', () => {
    expect(parseFenceInfo('ts')).toEqual({ lang: 'ts', filename: null, ...none });
    expect(parseFenceInfo('')).toEqual({ lang: null, filename: null, ...none });
  });

  it('reads title= and filename=', () => {
    expect(parseFenceInfo('ts title=src/a.ts')).toEqual({
      lang: 'ts',
      filename: 'src/a.ts',
      ...none,
    });
    expect(parseFenceInfo('ts title="src/a.ts"')).toEqual({
      lang: 'ts',
      filename: 'src/a.ts',
      ...none,
    });
    expect(parseFenceInfo("python filename='app.py'")).toEqual({
      lang: 'python',
      filename: 'app.py',
      ...none,
    });
  });

  it('reads ts:path and a bare path after the language', () => {
    expect(parseFenceInfo('ts:src/a.ts')).toEqual({ lang: 'ts', filename: 'src/a.ts', ...none });
    expect(parseFenceInfo('ts src/foo.ts')).toEqual({
      lang: 'ts',
      filename: 'src/foo.ts',
      ...none,
    });
  });

  it('ignores mermaid/math info as a filename', () => {
    expect(parseFenceInfo('mermaid title=diagram.mmd')).toEqual({
      lang: 'mermaid',
      filename: null,
      ...none,
    });
    expect(parseFenceInfo('math')).toEqual({ lang: 'math', filename: null, ...none });
  });

  it('ignores attribute-list braces', () => {
    expect(parseFenceInfo('ts {.line-numbers}')).toEqual({ lang: 'ts', filename: null, ...none });
  });

  it('reads startLine and a highlight range', () => {
    expect(parseFenceInfo('ts title=src/a.ts startLine=10 {10-20}')).toEqual({
      lang: 'ts',
      filename: 'src/a.ts',
      startLine: 10,
      highlight: { start: 10, end: 20 },
    });
    expect(parseFenceInfo('ts {10}')).toEqual({
      lang: 'ts',
      filename: null,
      startLine: null,
      highlight: { start: 10, end: 10 },
    });
  });
});
