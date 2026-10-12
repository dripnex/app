/** Convert `#rrggbb` to rgba(). Other CSS colors pass through with a fallback alpha. */
export function hexToRgba(color: string, alpha: number): string {
  const hex = color.trim();
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  const digits = m?.[1];
  if (!digits) {
    return `color-mix(in srgb, ${hex || '#5eead4'} ${Math.round(alpha * 100)}%, transparent)`;
  }
  const n = Number.parseInt(digits, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
