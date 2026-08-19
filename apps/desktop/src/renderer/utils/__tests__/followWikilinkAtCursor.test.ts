import { describe, expect, it } from 'vitest';
import { wikilinkAtOffset } from '../followWikilinkAtCursor';

describe('wikilinkAtOffset', () => {
  it('finds a wikilink on the line that contains the offset', () => {
    const text = 'Intro\nSee [[Home#Setup]] now\nEnd';
    expect(wikilinkAtOffset(text, 10)).toEqual({ target: 'Home', anchor: 'Setup' });
    expect(wikilinkAtOffset(text, 0)).toBeNull();
  });
});
