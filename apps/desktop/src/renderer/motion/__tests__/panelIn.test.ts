import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { playMotion, setMotionScale, setPerformanceLow } from '../gsapRuntime';
import { shouldPlayPanelIn } from '../panelIn';

const here = dirname(fileURLToPath(import.meta.url));
const appSrc = readFileSync(join(here, '../../App.tsx'), 'utf8');
const aiPanelSrc = readFileSync(join(here, '../../components/ai/AiPanel.tsx'), 'utf8');
const globalCss = readFileSync(join(here, '../../styles/global.css'), 'utf8');

describe('shouldPlayPanelIn', () => {
  it('plays only when the panel goes from closed to open', () => {
    expect(shouldPlayPanelIn(false, true)).toBe(true);
    expect(shouldPlayPanelIn(true, true)).toBe(false);
    expect(shouldPlayPanelIn(false, false)).toBe(false);
    expect(shouldPlayPanelIn(true, false)).toBe(false);
  });
});

describe('panel-in runtime', () => {
  afterEach(() => {
    setMotionScale(1);
    setPerformanceLow(false);
  });

  it('travels 8px from the right in 180ms', () => {
    const pane = { opacity: 0, x: 8, y: 0, scale: 1 };
    const tween = playMotion('panel-in', pane as unknown as Element);
    expect(tween?.vars.duration).toBeCloseTo(0.18);
    expect(tween?.vars.x).toBe(0);
    expect(tween?.vars.opacity).toBe(1);
  });

  it('snaps when Performance is Low', () => {
    setPerformanceLow(true);
    const pane = { opacity: 0, x: 8, y: 0, scale: 1 };
    expect(playMotion('panel-in', pane as unknown as Element)).toBeNull();
    expect(pane.opacity).toBe(1);
    expect(pane.x).toBe(0);
  });
});

describe('AI panel chrome wiring', () => {
  it('plays GSAP panel-in on the aside, not the inner clip box', () => {
    expect(appSrc).toContain("playMotion('panel-in'");
    expect(appSrc).toContain('shouldPlayPanelIn');
    expect(appSrc).toContain('aiPanelRef');
    expect(aiPanelSrc).not.toContain("playMotion('panel-in'");
    expect(globalCss).not.toMatch(/\.app__ai-panel\s*\{[^}]*transition:\s*width/s);
    expect(globalCss).not.toMatch(/\.app__ai-panel\s*\{[^}]*overflow:\s*hidden/s);
  });
});
