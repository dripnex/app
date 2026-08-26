/**
 * Adapted from React Bits Letter Glitch (DavidHDev/react-bits).
 * clearRect only — never fill the canvas with --bg-base or #000
 * (Linux Electron compositor can cover the AuthGate form).
 */

export const ACCENT_FALLBACK = '#5eead4';
export const GLITCH_SPEED_MS = 50;
export const FONT_SIZE = 16;
export const CHAR_WIDTH = 10;
export const CHAR_HEIGHT = 20;
export const GLITCH_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789';

export type Rgb = { r: number; g: number; b: number };

export type GlitchLetter = {
  char: string;
  color: Rgb;
  startColor: Rgb;
  targetColor: Rgb;
  colorProgress: number;
};

export type LetterGrid = {
  letters: GlitchLetter[];
  columns: number;
  rows: number;
  colors: Rgb[];
  chars: string[];
  rng: () => number;
};

export function parseCssColor(input: string): Rgb | null {
  const hex = input.trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  const sr = short?.[1];
  const sg = short?.[2];
  const sb = short?.[3];
  if (sr && sg && sb) {
    return {
      r: Number.parseInt(sr + sr, 16),
      g: Number.parseInt(sg + sg, 16),
      b: Number.parseInt(sb + sb, 16),
    };
  }
  const full = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  const fr = full?.[1];
  const fg = full?.[2];
  const fb = full?.[3];
  if (fr && fg && fb) {
    return {
      r: Number.parseInt(fr, 16),
      g: Number.parseInt(fg, 16),
      b: Number.parseInt(fb, 16),
    };
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(hex);
  const rr = rgb?.[1];
  const rg = rgb?.[2];
  const rb = rgb?.[3];
  if (rr && rg && rb) {
    return { r: Number(rr), g: Number(rg), b: Number(rb) };
  }
  return null;
}

export function rgbCss(color: Rgb): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

export function mixTowardBlack(color: Rgb, amount: number): Rgb {
  const keep = 1 - amount;
  return {
    r: Math.round(color.r * keep),
    g: Math.round(color.g * keep),
    b: Math.round(color.b * keep),
  };
}

/** Accent plus two darker/muted siblings. Not the stock forest-green matrix. */
export function glitchColorsFromAccent(accent: string): [Rgb, Rgb, Rgb] {
  const base = parseCssColor(accent) ?? parseCssColor(ACCENT_FALLBACK) ?? { r: 94, g: 234, b: 212 };
  return [base, mixTowardBlack(base, 0.42), mixTowardBlack(base, 0.68)];
}

function pick<T>(items: T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)]!;
}

function lerpRgb(start: Rgb, end: Rgb, t: number): Rgb {
  return {
    r: Math.round(start.r + (end.r - start.r) * t),
    g: Math.round(start.g + (end.g - start.g) * t),
    b: Math.round(start.b + (end.b - start.b) * t),
  };
}

export function createLetterGrid(
  width: number,
  height: number,
  colors: Rgb[],
  rng: () => number = Math.random
): LetterGrid {
  const columns = Math.max(1, Math.ceil(width / CHAR_WIDTH));
  const rows = Math.max(1, Math.ceil(height / CHAR_HEIGHT));
  const chars = Array.from(GLITCH_CHARS);
  const palette = colors.length > 0 ? colors : glitchColorsFromAccent(ACCENT_FALLBACK);
  const letters: GlitchLetter[] = Array.from({ length: columns * rows }, () => {
    const color = pick(palette, rng);
    return {
      char: pick(chars, rng),
      color,
      startColor: color,
      targetColor: color,
      colorProgress: 1,
    };
  });
  return { letters, columns, rows, colors: palette, chars, rng };
}

/**
 * Glyphs only. Do not paint an opaque canvas background —
 * `.screen` already paints `--bg-base`.
 */
export function paintLetterGlitch(
  ctx: CanvasRenderingContext2D,
  grid: LetterGrid,
  width: number,
  height: number
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.font = `${FONT_SIZE}px monospace`;
  ctx.textBaseline = 'top';

  const { letters, columns } = grid;
  for (let index = 0; index < letters.length; index++) {
    const letter = letters[index]!;
    const x = (index % columns) * CHAR_WIDTH;
    const y = Math.floor(index / columns) * CHAR_HEIGHT;
    ctx.fillStyle = rgbCss(letter.color);
    ctx.fillText(letter.char, x, y);
  }
}

export function updateLetters(grid: LetterGrid, smooth = true): void {
  const { letters } = grid;
  if (letters.length === 0) return;
  const updateCount = Math.max(1, Math.floor(letters.length * 0.05));
  for (let i = 0; i < updateCount; i++) {
    const letter = letters[Math.floor(grid.rng() * letters.length)];
    if (!letter) continue;
    letter.char = pick(grid.chars, grid.rng);
    letter.targetColor = pick(grid.colors, grid.rng);
    if (!smooth) {
      letter.color = letter.targetColor;
      letter.startColor = letter.targetColor;
      letter.colorProgress = 1;
    } else {
      letter.startColor = letter.color;
      letter.colorProgress = 0;
    }
  }
}

export function stepSmoothColors(grid: LetterGrid, step = 0.05): boolean {
  let dirty = false;
  for (const letter of grid.letters) {
    if (letter.colorProgress >= 1) continue;
    letter.colorProgress = Math.min(1, letter.colorProgress + step);
    letter.color = lerpRgb(letter.startColor, letter.targetColor, letter.colorProgress);
    dirty = true;
  }
  return dirty;
}

export function startLetterGlitchLoop(options: {
  reduceMotion: boolean;
  requestAnimationFrame: (cb: FrameRequestCallback) => number;
  cancelAnimationFrame: (id: number) => void;
  onFrame: () => void;
}): { stop: () => void; looping: boolean } {
  if (options.reduceMotion) {
    return { stop: () => {}, looping: false };
  }

  let id = 0;
  let stopped = false;
  const loop = () => {
    if (stopped) return;
    options.onFrame();
    id = options.requestAnimationFrame(loop);
  };
  id = options.requestAnimationFrame(loop);
  return {
    stop: () => {
      stopped = true;
      options.cancelAnimationFrame(id);
    },
    looping: true,
  };
}
