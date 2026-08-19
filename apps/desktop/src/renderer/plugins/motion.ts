import type { PluginManifest } from '@dripnex/plugin-api';

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
  description: 'Scales UI transition tokens. Custom animations go in styles.css.',

  configSchema: {
    scale: {
      type: 'number',
      default: 1,
      description: 'Duration multiplier (0 = instant, 1 = default, 2 = slow)',
    },
  },

  activate(context) {
    applyScale(context.config.get<number>('scale') ?? 1);
    const unobserve = context.config.observe<number>('scale', value => {
      applyScale(Number(value));
    });
    return {
      dispose() {
        unobserve();
        document.getElementById(STYLE_ID)?.remove();
      },
    };
  },
};
