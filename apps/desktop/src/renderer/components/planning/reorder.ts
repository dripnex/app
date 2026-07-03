/**
 * Pure ordering helper for the Planning board — kept side-effect free so it can
 * be unit-tested independently of React/DnD.
 */

export type ReorderSide = 'above' | 'below' | 'append';

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
