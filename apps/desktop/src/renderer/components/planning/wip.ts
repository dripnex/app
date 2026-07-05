/**
 * Pure WIP-limit helpers for the Planning board — side-effect free for testing.
 */

/** A column is over its WIP limit when a positive limit is set and exceeded. */
export function isOverWipLimit(count: number, limit: number | null | undefined): boolean {
  return typeof limit === 'number' && limit > 0 && count > limit;
}

/** Parse a raw WIP-limit input into a stored value: a positive int, or null (no limit). */
export function parseWipLimit(raw: string): number | null {
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
