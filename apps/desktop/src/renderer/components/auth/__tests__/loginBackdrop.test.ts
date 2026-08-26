import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AUTH_GATE_FORM_Z_INDEX, LOGIN_BACKDROP_Z_INDEX } from '../authGateStacking';
import {
  ACCENT_FALLBACK,
  createLetterGrid,
  glitchColorsFromAccent,
  paintLetterGlitch,
  startLetterGlitchLoop,
} from '../letterGlitch';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '../LoginBackdrop.module.css'), 'utf8');
const src = readFileSync(join(here, '../LoginBackdrop.tsx'), 'utf8');
const glitchSrc = readFileSync(join(here, '../letterGlitch.ts'), 'utf8');

const OPAQUE_FILL =
  /fillStyle:(#000(?:000)?|#0a0b0d|black|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)|--bg-base)/i;

function seededRng(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function recordingContext() {
  const calls: string[] = [];
  const ctx = {
    calls,
    font: '',
    textBaseline: '',
    clearRect: (...args: number[]) => {
      calls.push(`clearRect:${args.join(',')}`);
    },
    fillRect: (...args: number[]) => {
      calls.push(`fillRect:${args.join(',')}`);
    },
    fillText: (text: string, x: number, y: number) => {
      calls.push(`fillText:${text}:${x}:${y}`);
    },
    set fillStyle(value: string) {
      calls.push(`fillStyle:${value}`);
    },
  };
  return ctx;
}

describe('LoginBackdrop cannot paint over AuthGate', () => {
  it('keeps the canvas layer at z-index 0 behind the form', () => {
    expect(LOGIN_BACKDROP_Z_INDEX).toBe(0);
    expect(AUTH_GATE_FORM_Z_INDEX).toBeGreaterThan(LOGIN_BACKDROP_Z_INDEX);
    expect(css).toMatch(/\.layer\s*\{[^}]*z-index:\s*0/s);
    expect(css).toContain('pointer-events: none');
    expect(css).toContain('background: transparent');
    expect(src).toContain('zIndex: LOGIN_BACKDROP_Z_INDEX');
    expect(src).toContain('data-auth-gate="backdrop"');
  });

  it('does not fill the canvas with opaque paper or black', () => {
    const ctx = recordingContext();
    const colors = glitchColorsFromAccent(ACCENT_FALLBACK);
    const grid = createLetterGrid(80, 40, colors, seededRng());
    paintLetterGlitch(ctx as unknown as CanvasRenderingContext2D, grid, 80, 40);

    expect(ctx.calls.some(call => call.startsWith('clearRect:'))).toBe(true);
    expect(ctx.calls.some(call => call.startsWith('fillRect:'))).toBe(false);
    expect(ctx.calls.some(call => OPAQUE_FILL.test(call))).toBe(false);
    expect(ctx.calls.some(call => call.startsWith('fillText:'))).toBe(true);

    expect(src).not.toContain("readToken('--bg-base'");
    expect(src).not.toMatch(/\.fillRect\s*\(/);
    expect(glitchSrc).not.toMatch(/\.fillRect\s*\(/);
    expect(src + css + glitchSrc).not.toMatch(/background(?:-color|Color):\s*['"]?#000/i);
    expect(css).not.toMatch(/background:\s*#000/);
  });
});

describe('letter-glitch colors follow Dripnex accent', () => {
  it('uses --accent teal plus two darker siblings, not stock forest green', () => {
    const [accent, darker, muted] = glitchColorsFromAccent('#5eead4');
    expect(accent).toEqual({ r: 94, g: 234, b: 212 });
    expect(darker.g).toBeLessThan(accent.g);
    expect(muted.g).toBeLessThan(darker.g);
    expect(darker.r).toBeGreaterThan(0);
    expect(JSON.stringify([accent, darker, muted])).not.toContain('43, 69, 57');
  });
});

describe('letter-glitch reduced motion', () => {
  it('does not start a rAF loop when reduced motion is preferred', () => {
    let rafCalls = 0;
    const result = startLetterGlitchLoop({
      reduceMotion: true,
      requestAnimationFrame: () => {
        rafCalls += 1;
        return 1;
      },
      cancelAnimationFrame: () => {},
      onFrame: () => {},
    });
    expect(result.looping).toBe(false);
    expect(rafCalls).toBe(0);
  });

  it('starts a rAF loop when motion is allowed', () => {
    const queued: FrameRequestCallback[] = [];
    const result = startLetterGlitchLoop({
      reduceMotion: false,
      requestAnimationFrame: cb => {
        queued.push(cb);
        return queued.length;
      },
      cancelAnimationFrame: () => {},
      onFrame: () => {},
    });
    expect(result.looping).toBe(true);
    expect(queued).toHaveLength(1);
    result.stop();
  });

  it('invokes requestAnimationFrame as a window method, not an unbound extract', () => {
    expect(src).toContain('window.requestAnimationFrame(cb)');
    expect(src).toContain('window.cancelAnimationFrame(id)');
    expect(src).not.toMatch(/startLetterGlitchLoop\(\{[^}]*requestAnimationFrame,/s);
  });
});
