import { useEffect, useRef } from 'react';
import { hexToRgba } from './hexToRgba';
import styles from './LoginBackdrop.module.css';

const FRAME_COUNT = 16;
const CYCLE_MS = 16000;

function readToken(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function paintTunnel(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  phase: number,
  accent: string,
  paper: string
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);

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

/**
 * Perspective corridor of paper-and-ink frames behind AuthGate.
 * Slow forward motion. Frozen to one frame when the user prefers reduced motion.
 */
export function LoginBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = prefersReducedMotion();
    let raf = 0;
    let start = performance.now();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (phase: number) => {
      resize();
      paintTunnel(
        ctx,
        canvas.clientWidth,
        canvas.clientHeight,
        phase,
        readToken('--accent', '#5eead4'),
        readToken('--bg-base', '#0a0b0d')
      );
    };

    if (reduceMotion) {
      draw(0.38);
      return;
    }

    const loop = (now: number) => {
      draw(((now - start) / CYCLE_MS) % 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onScheme = () => {
      start = performance.now();
    };
    const observer = new MutationObserver(onScheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-color-scheme'],
    });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <div aria-hidden="true" className={styles.layer}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.veil} />
    </div>
  );
}
