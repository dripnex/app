/**
 * Color Utility Functions
 *
 * Provides utilities for color manipulation (darken, lighten, conversion)
 * to replace fragile regex-based color computation.
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface HSL {
  h: number;
  s: number;
  l: number;
}

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): RGB | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result || !result[1] || !result[2] || !result[3]) {
    return null;
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGB to hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map(x => {
        const hex = Math.round(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
  );
}

/**
 * Convert RGB to HSL
 */
export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to RGB
 */
export function hslToRgb(h: number, s: number, l: number): RGB {
  h /= 360;
  s /= 100;
  l /= 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: r * 255,
    g: g * 255,
    b: b * 255,
  };
}

/**
 * Darken a color by a percentage (0-1)
 */
export function darkenColor(color: string, amount: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  hsl.l = Math.max(0, hsl.l - amount * 100);

  const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

/**
 * Lighten a color by a percentage (0-1)
 */
export function lightenColor(color: string, amount: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  hsl.l = Math.min(100, hsl.l + amount * 100);

  const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

/**
 * Compute hover color (slightly darker)
 */
export function computeHoverColor(color: string): string {
  return darkenColor(color, 0.15);
}

/**
 * Multiply a CSS color's alpha by `keep` (0–1). Used to push frosted
 * surfaces toward the desktop without rewriting the palette.
 */
export function scaleCssAlpha(color: string, keep: number): string {
  const k = Math.min(1, Math.max(0.08, keep));
  const trimmed = color.trim();
  const rgba = /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i.exec(
    trimmed
  );
  if (rgba) {
    const a = Number((parseFloat(rgba[4]!) * k).toFixed(3));
    return `rgba(${rgba[1]}, ${rgba[2]}, ${rgba[3]}, ${a})`;
  }
  const rgb = /^rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i.exec(trimmed);
  if (rgb) {
    return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${k.toFixed(3)})`;
  }
  const hex = hexToRgb(trimmed);
  if (hex) return `rgba(${hex.r}, ${hex.g}, ${hex.b}, ${k.toFixed(3)})`;
  return color;
}

/** Replace a CSS color's alpha. Used when Performance is Low (no blur). */
export function withCssAlpha(color: string, alpha: number): string {
  const a = Number(Math.min(1, Math.max(0, alpha)).toFixed(3));
  const trimmed = color.trim();
  const rgba = /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*[\d.]+\s*\)$/i.exec(trimmed);
  if (rgba) return `rgba(${rgba[1]}, ${rgba[2]}, ${rgba[3]}, ${a})`;
  const rgb = /^rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i.exec(trimmed);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${a})`;
  const hex = hexToRgb(trimmed);
  if (hex) return `rgba(${hex.r}, ${hex.g}, ${hex.b}, ${a})`;
  return color;
}
