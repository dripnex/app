/** Shared accent / tag swatches. Settings, tags, and pickers must use this. */
export const ACCENT_SWATCHES = [
  { value: '#5eead4', label: 'Teal' },
  { value: '#60a5fa', label: 'Blue' },
  { value: '#a78bfa', label: 'Purple' },
  { value: '#f472b6', label: 'Pink' },
  { value: '#fb7185', label: 'Rose' },
  { value: '#fb923c', label: 'Orange' },
  { value: '#4ade80', label: 'Green' },
  { value: '#fbbf24', label: 'Amber' },
] as const;

export const TAG_COLORS: string[] = ACCENT_SWATCHES.map(swatch => swatch.value);

export function fallbackTagColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length] ?? TAG_COLORS[0]!;
}
