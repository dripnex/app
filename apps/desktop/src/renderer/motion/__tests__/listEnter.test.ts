import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { LIST_ENTER_STAGGER_CAP, elementsForNoteIds, planListEnter } from '../listEnter';
import { playListEnter, playMotion, setMotionScale, setPerformanceLow } from '../gsapRuntime';

const here = dirname(fileURLToPath(import.meta.url));
const noteListCss = readFileSync(join(here, '../../components/NoteList.module.css'), 'utf8');
const noteListSrc = readFileSync(join(here, '../../components/NoteList.tsx'), 'utf8');

describe('planListEnter', () => {
  it('staggers the first visible set', () => {
    expect(planListEnter({ noteIds: ['a', 'b'], seenIds: new Set() })).toEqual({
      mode: 'all',
      ids: ['a', 'b'],
    });
  });

  it('only enters notes that were not already on screen', () => {
    expect(
      planListEnter({
        noteIds: ['a', 'b', 'c'],
        seenIds: new Set(['a', 'b']),
      })
    ).toEqual({ mode: 'new', ids: ['c'] });
  });

  it('does not restagger overlapping rows when the filter narrows', () => {
    expect(
      planListEnter({
        noteIds: ['b'],
        seenIds: new Set(['a', 'b', 'c']),
      })
    ).toEqual({ mode: 'none', ids: [] });
  });

  it('skips an empty list', () => {
    expect(planListEnter({ noteIds: [], seenIds: new Set() })).toEqual({
      mode: 'none',
      ids: [],
    });
  });
});

describe('elementsForNoteIds', () => {
  it('is a no-op outside a document', () => {
    expect(elementsForNoteIds(['a'])).toEqual([]);
  });
});

describe('playListEnter / list-select', () => {
  afterEach(() => {
    setMotionScale(1);
    setPerformanceLow(false);
  });

  it('snaps rows to the end state when Performance is Low', () => {
    setPerformanceLow(true);
    const row = { opacity: 0, x: 6, y: 8 };
    expect(playListEnter([row as unknown as Element])).toBeNull();
    expect(row.opacity).toBe(1);
    expect(row.x).toBe(0);
    expect(row.y).toBe(0);
  });

  it('snaps selection when the motion scale is 0', () => {
    setMotionScale(0);
    const row = { opacity: 0.5, x: 6, y: 4, scale: 1 };
    expect(playMotion('list-select', row as unknown as Element)).toBeNull();
    expect(row.opacity).toBe(1);
    expect(row.x).toBe(0);
    expect(row.y).toBe(0);
  });

  it('caps stagger so long lists do not keep moving', () => {
    expect(LIST_ENTER_STAGGER_CAP).toBe(10);
  });
});

describe('note list wiring', () => {
  it('does not keep a CSS enter animation that would ignore Performance → Low', () => {
    expect(noteListCss).not.toMatch(/fade-slide-in/);
    expect(noteListCss).not.toMatch(/animation-delay:\s*calc\(var\(--item-index/);
  });

  it('plays GSAP list-in and list-select from the list chrome', () => {
    expect(noteListSrc).toContain("playMotion('list-select'");
    expect(noteListSrc).toContain('playListEnter(');
  });
});
