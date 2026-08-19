import { describe, expect, it } from 'vitest';
import { isMissingWikilink, knownTitlesFromResolution } from '../isMissingWikilink';

describe('isMissingWikilink', () => {
  it('does not mark anything until titles are ready', () => {
    expect(isMissingWikilink('Note', { status: 'pending' })).toBe(false);
    expect(isMissingWikilink('Note', { status: 'error' })).toBe(false);
  });

  it('treats empty and heading-only targets as not missing', () => {
    const ready = { status: 'ready' as const, titles: new Set<string>() };
    expect(isMissingWikilink('', ready)).toBe(false);
    expect(isMissingWikilink('   ', { status: 'ready', titles: new Set(['home']) })).toBe(false);
  });

  it('matches titles case-insensitively', () => {
    const ready = { status: 'ready' as const, titles: new Set(['home']) };
    expect(isMissingWikilink('Home', ready)).toBe(false);
    expect(isMissingWikilink('Missing', ready)).toBe(true);
  });
});

describe('knownTitlesFromResolution', () => {
  it('exposes titles only when ready', () => {
    const titles = new Set(['home']);
    expect(knownTitlesFromResolution({ status: 'pending' })).toBeNull();
    expect(knownTitlesFromResolution({ status: 'error' })).toBeNull();
    expect(knownTitlesFromResolution({ status: 'ready', titles })).toBe(titles);
  });
});
