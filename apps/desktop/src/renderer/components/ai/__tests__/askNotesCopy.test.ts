import { describe, expect, it } from 'vitest';
import {
  askNotesEmptyCopy,
  askNotesMatchMode,
  askNotesPlaceholder,
  kbIndexDescription,
  kbStatusLabel,
} from '../askNotesCopy';

describe('askNotesMatchMode', () => {
  it('is words until at least one embedding exists', () => {
    expect(askNotesMatchMode(undefined)).toBe('words');
    expect(askNotesMatchMode(0)).toBe('words');
    expect(askNotesMatchMode(3)).toBe('meaning');
  });
});

describe('askNotes copy', () => {
  it('tells the user Ask Notes is words-only without embeddings', () => {
    expect(askNotesEmptyCopy('words')).toContain('words in your notes');
    expect(askNotesEmptyCopy('words')).toContain('Settings → AI');
    expect(askNotesPlaceholder('words')).toContain('words');
  });

  it('mentions meaning once the index has embeddings', () => {
    expect(askNotesEmptyCopy('meaning')).toContain('meaning');
    expect(askNotesPlaceholder('meaning')).toContain('Ask your notes');
  });
});

describe('kbStatusLabel', () => {
  it('flags a missing preload separately from an empty index', () => {
    expect(kbStatusLabel(null, true)).toBe('Preload missing — restart Dripnex');
    expect(kbStatusLabel(null, false)).toContain('matches words only');
  });

  it('keeps counts and adds the words-only hint when nothing is embedded', () => {
    expect(kbStatusLabel({ embedded: 0, pending: 4 }, false)).toBe(
      '0 embedded · 4 waiting · Ask Notes matches words only'
    );
    expect(kbStatusLabel({ embedded: 12, pending: 1 }, false)).toBe('12 embedded · 1 waiting');
  });
});

describe('kbIndexDescription', () => {
  it('explains the words-only fallback when the index is empty', () => {
    expect(kbIndexDescription(0)).toContain('matches words');
    expect(kbIndexDescription(2)).toContain('Vectors never leave');
  });
});
