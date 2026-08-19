import { describe, expect, it } from 'vitest';
import { isMissingWikilink } from '../isMissingWikilink';

describe('isMissingWikilink', () => {
  it('does not mark anything until titles are resolved', () => {
    expect(isMissingWikilink('Note', null)).toBe(false);
  });

  it('treats empty and heading-only targets as not missing', () => {
    expect(isMissingWikilink('', new Set())).toBe(false);
    expect(isMissingWikilink('   ', new Set(['home']))).toBe(false);
  });

  it('matches titles case-insensitively', () => {
    const known = new Set(['home']);
    expect(isMissingWikilink('Home', known)).toBe(false);
    expect(isMissingWikilink('Missing', known)).toBe(true);
  });
});
