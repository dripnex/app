import type { PluginManifest } from '@dripnex/plugin-api';
import { setMotionScale } from '../motion/gsapRuntime';

/**
 * Motion — duration and easing live on CSS tokens.
 * Custom keyframes belong in the user stylesheet (Plugins → Open User Stylesheet).
 * This plugin only scales the built-in durations.
 */
const STYLE_ID = 'dripnex-motion-scale';

function applyScale(scale: number): void {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  const n = Number.isFinite(scale) ? Math.min(2, Math.max(0, scale)) : 1;
  el.textContent =
    n === 1
      ? ''
      : `:root { --transition-fast: ${150 * n}ms ease; --transition-normal: ${200 * n}ms ease; --transition-slow: ${300 * n}ms ease; }`;
}

export const motionPlugin: PluginManifest = {
  id: 'dripnex-motion',
  name: 'Motion',
  version: '1.0.0',
  description: 'Scales CSS transitions and GSAP event motion. 0 = instant.',

  configSchema: {
    scale: {
      type: 'number',
      default: 1,
      description: 'Duration multiplier (0 = instant, 1 = default, 2 = slow)',
    },
  },

  activate(context) {
    const apply = (value: number) => {
      applyScale(value);
      setMotionScale(value);
    };
    apply(context.config.get<number>('scale') ?? 1);
    const unobserve = context.config.observe<number>('scale', value => {
      apply(Number(value));
    });
    return {
      dispose() {
        unobserve();
        setMotionScale(1);
        document.getElementById(STYLE_ID)?.remove();
      },
    };
  },
};
