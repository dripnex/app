import { describe, expect, it } from 'vitest';
import { createWikilinkTitle } from '../src/adapters/codemirror/autocomplete';

describe('createWikilinkTitle', () => {
  it('returns null for an empty query', () => {
    expect(createWikilinkTitle('  ', [])).toBeNull();
  });

  it('returns the trimmed title when nothing matches', () => {
    expect(createWikilinkTitle('  New idea ', [{ id: '1', title: 'Old' }])).toBe('New idea');
  });

  it('returns null on an exact title match', () => {
    expect(createWikilinkTitle('Inbox', [{ id: '1', title: 'inbox' }])).toBeNull();
  });

  it('strips brackets that would break the wikilink', () => {
    expect(createWikilinkTitle('Foo]Bar', [])).toBe('FooBar');
  });
});
