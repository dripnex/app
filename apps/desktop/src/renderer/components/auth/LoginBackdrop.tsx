import { useEffect, useRef } from 'react';
import { LOGIN_BACKDROP_Z_INDEX } from './authGateStacking';
import {
  ACCENT_FALLBACK,
  GLITCH_SPEED_MS,
  createLetterGrid,
  glitchColorsFromAccent,
  paintLetterGlitch,
  startLetterGlitchLoop,
  stepSmoothColors,
  updateLetters,
  type LetterGrid,
} from './letterGlitch';
import styles from './LoginBackdrop.module.css';

function readToken(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function readGlitchColors() {
  return glitchColorsFromAccent(readToken('--accent', ACCENT_FALLBACK));
}

/**
 * Matrix-style letter grid behind AuthGate.
 * Adapted from React Bits Letter Glitch (DavidHDev/react-bits).
 * Frozen to one frame when the user prefers reduced motion.
 */
export function LoginBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const reduceMotion = prefersReducedMotion();
    let grid: LetterGrid = createLetterGrid(1, 1, readGlitchColors());
    let lastGlitch = Date.now();

    const paint = () => {
      paintLetterGlitch(ctx, grid, canvas.clientWidth, canvas.clientHeight);
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, canvas.clientWidth);
      const h = Math.max(1, canvas.clientHeight);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      grid = createLetterGrid(w, h, readGlitchColors());
      paint();
    };

    resize();

    const loop = startLetterGlitchLoop({
      reduceMotion,
      requestAnimationFrame: cb => window.requestAnimationFrame(cb),
      cancelAnimationFrame: id => window.cancelAnimationFrame(id),
      onFrame: () => {
        const now = Date.now();
        if (now - lastGlitch >= GLITCH_SPEED_MS) {
          updateLetters(grid);
          paint();
          lastGlitch = now;
        } else if (stepSmoothColors(grid)) {
          paint();
        }
      },
    });

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resize, 100);
    };
    window.addEventListener('resize', handleResize);

    const observer = new MutationObserver(() => {
      grid.colors = readGlitchColors();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-color-scheme'],
    });

    return () => {
      loop.stop();
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
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
