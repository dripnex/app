import { describe, expect, it } from 'vitest';
import { titleFromHtml } from '../htmlTitle.js';

describe('titleFromHtml', () => {
  it('reads a plain title', () => {
    expect(titleFromHtml('<html><title>Hello</title></html>')).toBe('Hello');
  });

  it('unescapes entities and flattens newlines', () => {
    expect(titleFromHtml('<title>A &amp; B\nC</title>')).toBe('A & B C');
  });

  it('does not double-unescape stacked entities', () => {
    expect(titleFromHtml('<title>&amp;lt;</title>')).toBe('&lt;');
  });

  it('keeps a less-than in the title text', () => {
    expect(titleFromHtml('<title>C < C++</title>')).toBe('C < C++');
  });

  it('returns null when there is no title', () => {
    expect(titleFromHtml('<html><p>none</p></html>')).toBeNull();
  });
});
