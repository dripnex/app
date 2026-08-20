import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { nodeText, splitCodeLines } from '../splitCodeLines';

describe('splitCodeLines', () => {
  it('splits a plain string on newlines and drops a trailing empty line', () => {
    expect(splitCodeLines('one\ntwo\n')).toEqual([['one'], ['two']]);
  });

  it('keeps a highlight span on one line', () => {
    const keyword = createElement('span', { className: 'hljs-keyword' }, 'const');
    const lines = splitCodeLines([keyword, ' x = 1\nnext']);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual([keyword, ' x = 1']);
    expect(lines[1]).toEqual(['next']);
  });

  it('splits a span that itself contains a newline', () => {
    const span = createElement('span', { className: 'hljs-string' }, '"a\nb"');
    const lines = splitCodeLines(span);
    expect(lines).toHaveLength(2);
  });
});

describe('nodeText', () => {
  it('joins highlighted children into the source string', () => {
    const keyword = createElement('span', { className: 'hljs-keyword' }, 'const');
    expect(nodeText([keyword, ' x = 1'])).toBe('const x = 1');
  });
});
