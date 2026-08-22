import { useEffect, useState } from 'react';
import { MeshGradient } from '@paper-design/shaders-react';
import styles from './LoginBackdrop.module.css';

const DARK_FALLBACK = ['#0a0b0d', '#111214', '#18191c', '#1c1c1c'] as const;
const LIGHT_FALLBACK = ['#f3f2ee', '#e7e5df', '#fffcf7', '#eceae4'] as const;

function readToken(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function isLightScheme(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-color-scheme') === 'light'
  );
}

function meshColors(light: boolean): string[] {
  const fallbacks = light ? LIGHT_FALLBACK : DARK_FALLBACK;
  return [
    readToken('--bg-base', fallbacks[0]),
    readToken('--bg-surface', fallbacks[1]),
    readToken('--bg-elevated', fallbacks[2]),
    readToken('--bg-inset', fallbacks[3]),
  ];
}

/**
 * Quiet wash behind AuthGate. Colors follow the active palette tokens
 * so light/dark (and named themes) stay aligned. Motion is decorative
 * only — prefers-reduced-motion freezes it.
 */
export function LoginBackdrop() {
  const [colors, setColors] = useState(() => meshColors(isLightScheme()));

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setColors(meshColors(isLightScheme()));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['data-color-scheme'] });
    return () => observer.disconnect();
  }, []);

  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div aria-hidden="true" className={styles.layer}>
      <MeshGradient
        colors={colors}
        distortion={0.42}
        swirl={0.18}
        speed={reduceMotion ? 0 : 0.08}
        style={{ width: '100%', height: '100%' }}
      />
      <div className={styles.veil} />
    </div>
  );
}
