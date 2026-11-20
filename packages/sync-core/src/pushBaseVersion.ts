/**
 * Value to send as `localVersion` on a push.
 *
 * The server compares this with the sync-log version of the same row.
 * That number is a per-user counter, not the local edit counter.
 * `storedServerVersion` is the sync-log version last applied for this row.
 * When that is missing, `seenCursor` is the highest version this device
 * has pulled. It uses the same counter, so a row edited past the cursor
 * still conflicts. Zero for both means omit the field.
 */
export function pushBaseVersion(
  storedServerVersion: number | null | undefined,
  seenCursor = 0
): number | undefined {
  const stored = positiveVersion(storedServerVersion);
  if (stored !== undefined) return stored;
  return positiveVersion(seenCursor);
}

function positiveVersion(value: number | null | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.trunc(value);
}
