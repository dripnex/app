export type PaletteMode = 'commands' | 'notes' | 'notebooks' | 'tags';

export const PALETTE_MODE_COMMANDS = new Set([
  'app:command-palette',
  'app:quick-open',
  'app:jump-notebook',
  'app:jump-tag',
]);

export function filterByQuery<T>(
  items: readonly T[],
  query: string,
  getText: (item: T) => string
): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...items];
  return items.filter(item => getText(item).toLowerCase().includes(needle));
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
      return 'Run a command…';
    case 'notes':
      return 'Quick Open a note…';
    case 'notebooks':
      return 'Jump to a notebook…';
    case 'tags':
      return 'Jump to a tag…';
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
  }
}
