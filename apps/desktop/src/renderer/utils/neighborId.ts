/** Next/prev id in a visible list. Stops at the ends; no wrap. */
export function neighborId(
  ids: readonly string[],
  current: string | null,
  direction: 1 | -1
): string | null {
  if (ids.length === 0) return null;
  if (!current) return direction === 1 ? (ids[0] ?? null) : (ids[ids.length - 1] ?? null);
  const index = ids.indexOf(current);
  if (index < 0) return direction === 1 ? (ids[0] ?? null) : (ids[ids.length - 1] ?? null);
  return ids[index + direction] ?? null;
}
