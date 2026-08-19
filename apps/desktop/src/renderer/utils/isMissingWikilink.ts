export type WikilinkTitleResolution =
  | { status: 'pending' }
  | { status: 'ready'; titles: ReadonlySet<string> }
  | { status: 'error' };

export function knownTitlesFromResolution(
  resolution: WikilinkTitleResolution
): ReadonlySet<string> | null {
  return resolution.status === 'ready' ? resolution.titles : null;
}

/** True only after a successful lookup, when `target` is not among the titles. */
export function isMissingWikilink(target: string, resolution: WikilinkTitleResolution): boolean {
  if (resolution.status !== 'ready') return false;
  const title = target.trim();
  if (!title) return false;
  return !resolution.titles.has(title.toLowerCase());
}
