/** True once titles have been resolved and `target` is not among them. */
export function isMissingWikilink(
  target: string,
  knownTitles: ReadonlySet<string> | null
): boolean {
  const title = target.trim();
  if (!title || !knownTitles) return false;
  return !knownTitles.has(title.toLowerCase());
}
