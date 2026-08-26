import { useEffect, useRef } from 'react';
import { LOGIN_BACKDROP_Z_INDEX } from './authGateStacking';
import { paintTunnel } from './paintTunnel';
import styles from './LoginBackdrop.module.css';

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
        readToken('--accent', '#5eead4')
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
    <div
      aria-hidden="true"
      className={styles.layer}
      style={{ zIndex: LOGIN_BACKDROP_Z_INDEX }}
      data-auth-gate="backdrop"
    >
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.veil} />
    </div>
  );
}
