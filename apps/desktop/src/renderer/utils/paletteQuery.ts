export type PaletteMode = 'commands' | 'notes' | 'notebooks' | 'tags' | 'headings';

export const PALETTE_MODE_COMMANDS = new Set([
  'app:command-palette',
  'app:quick-open',
  'app:jump-notebook',
  'app:jump-tag',
  'app:jump-heading',
]);

export function filterByQuery<T>(
  items: readonly T[],
  query: string,
  getText: (item: T) => string
): T[] {
  return fuzzyFilter(items, query, getText);
}

/**
 * Telescope prefixes. `>` and `#` can stand alone; `b` / `t` need a space
 * so typing "blog" in the command list does not jump to notebooks.
 */
export function parsePaletteQuery(
  raw: string,
  fallback: PaletteMode
): { source: PaletteMode; needle: string; scoped: boolean } {
  const rules: { re: RegExp; source: PaletteMode }[] = [
    { re: /^>\s?/, source: 'commands' },
    { re: /^b\s/i, source: 'notebooks' },
    { re: /^t\s/i, source: 'tags' },
    { re: /^#\s?/, source: 'headings' },
  ];
  for (const rule of rules) {
    const match = raw.match(rule.re);
    if (match) {
      return { source: rule.source, needle: raw.slice(match[0].length), scoped: true };
    }
  }
  return { source: fallback, needle: raw, scoped: false };
}

/** Higher is better. `null` means the query chars are not a subsequence. */
export function fuzzyScore(text: string, query: string): number | null {
  const t = text.toLowerCase();
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const substring = t.indexOf(q);
  if (substring === 0) return 2000 - t.length;
  if (substring > 0) return 1200 - substring - t.length * 0.05;

  let ti = 0;
  let score = 0;
  let consecutive = 0;
  let prev = -2;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    consecutive = found === prev + 1 ? consecutive + 1 : 0;
    score += 8 + consecutive * 18;
    if (found === 0 || /[\s/_-]/.test(t[found - 1] ?? '')) score += 28;
    prev = found;
    ti = found + 1;
  }
  return score - t.length * 0.08;
}

export function fuzzyFilter<T>(
  items: readonly T[],
  query: string,
  getText: (item: T) => string
): T[] {
  const needle = query.trim();
  if (!needle) return [...items];
  return items
    .map(item => ({ item, score: fuzzyScore(getText(item), needle) }))
    .filter((row): row is { item: T; score: number } => row.score !== null)
    .sort((a, b) => b.score - a.score)
    .map(row => row.item);
}

export function notebookPath(
  notebooks: ReadonlyArray<{ id: string; name: string; parentId: string | null }>,
  id: string
): string {
  const byId = new Map(notebooks.map(nb => [nb.id, nb]));
  const parts: string[] = [];
  let current = byId.get(id);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    parts.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return parts.join(' / ');
}

export function palettePlaceholder(mode: PaletteMode): string {
  switch (mode) {
    case 'commands':
      return 'Run a command…    >  b   t   #';
    case 'notes':
      return 'Quick Open a note…';
    case 'notebooks':
      return 'Jump to a notebook…';
    case 'tags':
      return 'Jump to a tag…';
    case 'headings':
      return 'Jump to a heading…';
  }
}

export function paletteAriaLabel(mode: PaletteMode): string {
  switch (mode) {
    case 'commands':
      return 'Command Palette';
    case 'notes':
      return 'Quick Open';
    case 'notebooks':
      return 'Jump to Notebook';
    case 'tags':
      return 'Jump to Tag';
    case 'headings':
      return 'Jump to Heading';
  }
}
