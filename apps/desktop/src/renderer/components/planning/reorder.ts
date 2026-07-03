/**
 * Pure ordering helper for the Planning board — kept side-effect free so it can
 * be unit-tested independently of React/DnD.
 */

import type { BoardStage } from '../../../preload/index';

export type ReorderSide = 'above' | 'below' | 'append';

/**
 * Apply a column reorder to a list of notes for an optimistic cache update —
 * mirrors what the repo's reorderBoard does server-side: notes whose id is in
 * `orderedIds` get `boardStage = stage` and `boardOrder = their index`; every
 * other note is returned unchanged. Pure and generic so it can be unit-tested.
 */
export function applyBoardReorder<
  T extends { id: string; boardStage: BoardStage | null; boardOrder: number },
>(notes: readonly T[], stage: BoardStage, orderedIds: readonly string[]): T[] {
  const indexById = new Map(orderedIds.map((id, i) => [id, i]));
  return notes.map(note => {
    const index = indexById.get(note.id);
    return index === undefined ? note : { ...note, boardStage: stage, boardOrder: index };
  });
}

/**
 * Compute the new ordered id list for a column after dropping `draggedId`
 * relative to `targetId`.
 *
 * - Operates on the column's COMPLETE ordered id list (callers must pass the
 *   unfiltered column so hidden cards keep contiguous order).
 * - `targetId === null` or `side === 'append'` puts the card at the end.
 * - Dragging a card downward past its own slot is handled correctly because the
 *   dragged id is removed before the target index is computed.
 */
export function computeReorderedIds(
  currentOrderedIds: readonly string[],
  draggedId: string,
  targetId: string | null,
  side: ReorderSide
): string[] {
  // Dropping a card onto itself is a no-op (the UI also guards this).
  if (targetId === draggedId) return [...currentOrderedIds];
  const ids = currentOrderedIds.filter(id => id !== draggedId);
  let insertAt = ids.length;
  if (targetId !== null && side !== 'append') {
    const ti = ids.indexOf(targetId);
    if (ti !== -1) insertAt = side === 'below' ? ti + 1 : ti;
  }
  ids.splice(insertAt, 0, draggedId);
  return ids;
}
