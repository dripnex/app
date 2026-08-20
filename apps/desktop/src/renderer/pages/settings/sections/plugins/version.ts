/** Compare dotted versions. `1.2.0` is newer than `1.1.9`. Pre-release suffixes are ignored. */
export function versionNewer(latest: string, installed: string): boolean {
  const parse = (raw: string) =>
    raw
      .replace(/^v/i, '')
      .split(/[-+]/)[0]
      ?.split('.')
      .map(part => parseInt(part, 10) || 0) ?? [];
  const a = parse(latest);
  const b = parse(installed);
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}
