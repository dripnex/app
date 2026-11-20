/**
 * Value to send as `localVersion` on a push.
 *
 * The server compares this with the sync-log version of the same row.
 * That number is a per-user counter, not the local edit counter.
 * `storedServerVersion` is the sync-log version last applied for this row.
 * Zero means this install has not recorded one yet, so omit the field and
 * let the server apply the push. The next success stores the real version.
 */
export function pushBaseVersion(
  storedServerVersion: number | null | undefined
): number | undefined {
  if (
    typeof storedServerVersion !== 'number' ||
    !Number.isFinite(storedServerVersion) ||
    storedServerVersion <= 0
  ) {
    return undefined;
  }
  return Math.trunc(storedServerVersion);
}
