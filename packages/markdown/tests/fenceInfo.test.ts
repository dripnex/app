import { describe, expect, it } from 'vitest';
import { parseFenceInfo } from '../src/fenceInfo.js';

describe('parseFenceInfo', () => {
  it('reads a bare language', () => {
    expect(parseFenceInfo('ts')).toEqual({ lang: 'ts', filename: null });
    expect(parseFenceInfo('')).toEqual({ lang: null, filename: null });
  });

  it('reads title= and filename=', () => {
    expect(parseFenceInfo('ts title=src/a.ts')).toEqual({ lang: 'ts', filename: 'src/a.ts' });
    expect(parseFenceInfo('ts title="src/a.ts"')).toEqual({ lang: 'ts', filename: 'src/a.ts' });
    expect(parseFenceInfo("python filename='app.py'")).toEqual({
      lang: 'python',
      filename: 'app.py',
    });
  });

  it('reads ts:path and a bare path after the language', () => {
    expect(parseFenceInfo('ts:src/a.ts')).toEqual({ lang: 'ts', filename: 'src/a.ts' });
    expect(parseFenceInfo('ts src/foo.ts')).toEqual({ lang: 'ts', filename: 'src/foo.ts' });
  });

  it('ignores mermaid/math info as a filename', () => {
    expect(parseFenceInfo('mermaid title=diagram.mmd')).toEqual({
      lang: 'mermaid',
      filename: null,
    });
    expect(parseFenceInfo('math')).toEqual({ lang: 'math', filename: null });
  });

  it('ignores attribute-list braces', () => {
    expect(parseFenceInfo('ts {.line-numbers}')).toEqual({ lang: 'ts', filename: null });
  });
});
