import { describe, expect, it } from 'vitest';
import { formatWikilink } from '../formatWikilink';

describe('formatWikilink', () => {
  it('formats a title, a heading, or both', () => {
    expect(formatWikilink('Home')).toBe('[[Home]]');
    expect(formatWikilink('Home', 'Setup')).toBe('[[Home#Setup]]');
    expect(formatWikilink('', 'Setup')).toBe('[[#Setup]]');
    expect(formatWikilink('  Home  ', '  Setup  ')).toBe('[[Home#Setup]]');
  });
});
