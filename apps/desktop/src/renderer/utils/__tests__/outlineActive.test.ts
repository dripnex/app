import { describe, expect, it } from 'vitest';
import { findHeadingForAnchor, headingIndexAtOrBefore, headingIndexByText } from '../outlineActive';

const headings = [
  { line: 1, text: 'Intro' },
  { line: 8, text: 'Setup' },
  { line: 20, text: 'Setup' },
];

describe('headingIndexAtOrBefore', () => {
  it('returns -1 before the first heading', () => {
    expect(headingIndexAtOrBefore(headings, 0)).toBe(-1);
  });

  it('stays on the last heading whose line we have passed', () => {
    expect(headingIndexAtOrBefore(headings, 1)).toBe(0);
    expect(headingIndexAtOrBefore(headings, 7)).toBe(0);
    expect(headingIndexAtOrBefore(headings, 8)).toBe(1);
    expect(headingIndexAtOrBefore(headings, 99)).toBe(2);
  });
});

describe('headingIndexByText', () => {
  it('matches the first heading with that text', () => {
    expect(headingIndexByText(headings, 'Setup')).toBe(1);
    expect(headingIndexByText(headings, null)).toBe(-1);
    expect(headingIndexByText(headings, 'Missing')).toBe(-1);
  });
});

describe('findHeadingForAnchor', () => {
  const md = '# Title\n\n## Setup\n\nHi\n\n## Hello World\n';

  it('matches slug and raw text', () => {
    expect(findHeadingForAnchor(md, 'setup')?.text).toBe('Setup');
    expect(findHeadingForAnchor(md, 'Hello World')?.text).toBe('Hello World');
    expect(findHeadingForAnchor(md, '#hello-world')?.line).toBe(7);
    expect(findHeadingForAnchor(md, 'nope')).toBeNull();
  });
});
