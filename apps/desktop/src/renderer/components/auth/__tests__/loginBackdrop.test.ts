import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LOGIN_BACKDROP_Z_INDEX } from '../authGateStacking';
import { paintTunnel } from '../paintTunnel';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '../LoginBackdrop.module.css'), 'utf8');
const src = readFileSync(join(here, '../LoginBackdrop.tsx'), 'utf8');

function recordingContext() {
  const calls: string[] = [];
  const ctx = {
    calls,
    clearRect: (...args: number[]) => {
      calls.push(`clearRect:${args.join(',')}`);
    },
    fillRect: (...args: number[]) => {
      calls.push(`fillRect:${args.join(',')}`);
    },
    beginPath: () => {
      calls.push('beginPath');
    },
    stroke: () => {
      calls.push('stroke');
    },
    rect: () => {
      calls.push('rect');
    },
    roundRect: () => {
      calls.push('roundRect');
    },
    set fillStyle(value: string) {
      calls.push(`fillStyle:${value}`);
    },
    set strokeStyle(value: string) {
      calls.push(`strokeStyle:${value}`);
    },
    set lineWidth(value: number) {
      calls.push(`lineWidth:${value}`);
    },
  };
  return ctx;
}

describe('LoginBackdrop cannot paint over AuthGate', () => {
  it('keeps the canvas layer at z-index 0 behind the form', () => {
    expect(LOGIN_BACKDROP_Z_INDEX).toBe(0);
    expect(css).toMatch(/\.layer\s*\{[^}]*z-index:\s*0/s);
    expect(css).toContain('pointer-events: none');
    expect(css).toContain('background: transparent');
    expect(src).toContain('zIndex: LOGIN_BACKDROP_Z_INDEX');
    expect(src).toContain('data-auth-gate="backdrop"');
  });

  it('does not fill the canvas with opaque paper', () => {
    const ctx = recordingContext();
    paintTunnel(ctx as unknown as CanvasRenderingContext2D, 800, 600, 0.38, '#5eead4');
    expect(ctx.calls.some(call => call.startsWith('clearRect:'))).toBe(true);
    expect(ctx.calls.some(call => call.startsWith('fillRect:'))).toBe(false);
    expect(ctx.calls.some(call => call.startsWith('fillStyle:'))).toBe(false);
    expect(ctx.calls.some(call => call === 'stroke')).toBe(true);
    expect(src).not.toContain("readToken('--bg-base'");
    expect(src).toContain("from './paintTunnel'");
  });
});
