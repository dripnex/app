import { describe, it, expect } from 'vitest';
import { computeReorderedIds, applyBoardReorder } from '../reorder';

describe('computeReorderedIds', () => {
  const col = ['a', 'b', 'c', 'd'];

  it('moves a card above a target', () => {
    expect(computeReorderedIds(col, 'd', 'b', 'above')).toEqual(['a', 'd', 'b', 'c']);
  });

  it('moves a card below a target', () => {
    expect(computeReorderedIds(col, 'a', 'c', 'below')).toEqual(['b', 'c', 'a', 'd']);
  });

  it('appends when targetId is null', () => {
    expect(computeReorderedIds(col, 'b', null, 'append')).toEqual(['a', 'c', 'd', 'b']);
  });

  it('handles dragging downward past its own slot (no off-by-one)', () => {
    // 'b' dropped below 'c' should land between c and d, not stay put.
    expect(computeReorderedIds(col, 'b', 'c', 'below')).toEqual(['a', 'c', 'b', 'd']);
  });

  it('is a no-op position when dropped above itself', () => {
    expect(computeReorderedIds(col, 'b', 'b', 'above')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('adds a card from another column at a position', () => {
    expect(computeReorderedIds(col, 'x', 'a', 'above')).toEqual(['x', 'a', 'b', 'c', 'd']);
  });

  it('appends an unknown target to the end', () => {
    expect(computeReorderedIds(col, 'a', 'zzz', 'below')).toEqual(['b', 'c', 'd', 'a']);
  });
});

describe('applyBoardReorder', () => {
  const notes = [
    { id: 'a', boardStage: 'backlog' as const, boardOrder: 0 },
    { id: 'b', boardStage: 'todo' as const, boardOrder: 3 },
    { id: 'x', boardStage: 'in_review' as const, boardOrder: 9 }, // in another column
  ];

  it('assigns stage + contiguous order to the reordered ids', () => {
    const out = applyBoardReorder(notes, 'todo', ['b', 'a']);
    expect(out.find(n => n.id === 'b')).toMatchObject({ boardStage: 'todo', boardOrder: 0 });
    expect(out.find(n => n.id === 'a')).toMatchObject({ boardStage: 'todo', boardOrder: 1 });
  });

  it('leaves notes not in the ordered list untouched', () => {
    const out = applyBoardReorder(notes, 'todo', ['b', 'a']);
    expect(out.find(n => n.id === 'x')).toEqual(notes[2]);
  });

  it('does not mutate the input array', () => {
    const snapshot = JSON.parse(JSON.stringify(notes));
    applyBoardReorder(notes, 'todo', ['b', 'a']);
    expect(notes).toEqual(snapshot);
  });
});
