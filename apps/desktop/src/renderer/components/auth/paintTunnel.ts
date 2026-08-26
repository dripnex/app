import { hexToRgba } from './hexToRgba';

const FRAME_COUNT = 16;

/**
 * Stroke the corridor only. Do not fill the canvas with opaque --bg-base:
 * on Linux Electron that fill can composite over the AuthGate form.
 */
export function paintTunnel(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  phase: number,
  accent: string
): void {
  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;
  const maxDim = Math.max(width, height);

  for (let i = 0; i < FRAME_COUNT; i++) {
    const t = (i / FRAME_COUNT + phase) % 1;
    const z = 0.06 + t * 0.94;
    const halfW = maxDim * 0.42 * z;
    const halfH = maxDim * 0.26 * z;
    const alpha = 0.05 + t * 0.22;
    ctx.strokeStyle = hexToRgba(accent, alpha);
    ctx.lineWidth = 0.8 + t * 1.4;
    const x = cx - halfW;
    const y = cy - halfH;
    const w = halfW * 2;
    const h = halfH * 2;
    const r = 10 + t * 8;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.stroke();
  }
}
