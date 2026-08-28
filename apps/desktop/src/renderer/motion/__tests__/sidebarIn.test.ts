import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { playMotion, setMotionScale, setPerformanceLow } from '../gsapRuntime';
import { shouldPlaySidebarIn } from '../sidebarIn';

const here = dirname(fileURLToPath(import.meta.url));
const appSrc = readFileSync(join(here, '../../App.tsx'), 'utf8');
const globalCss = readFileSync(join(here, '../../styles/global.css'), 'utf8');

describe('shouldPlaySidebarIn', () => {
  it('plays only when the pane goes from hidden to visible', () => {
    expect(shouldPlaySidebarIn(true, false)).toBe(true);
    expect(shouldPlaySidebarIn(false, false)).toBe(false);
    expect(shouldPlaySidebarIn(true, true)).toBe(false);
    expect(shouldPlaySidebarIn(false, true)).toBe(false);
  });
});

describe('sidebar-in runtime', () => {
  afterEach(() => {
    setMotionScale(1);
    setPerformanceLow(false);
  });

  it('snaps when Performance is Low', () => {
    setPerformanceLow(true);
    const pane = { opacity: 0, x: -8, y: 0, scale: 1 };
    expect(playMotion('sidebar-in', pane as unknown as Element)).toBeNull();
    expect(pane.opacity).toBe(1);
    expect(pane.x).toBe(0);
  });
});

describe('sidebar chrome wiring', () => {
  it('plays GSAP sidebar-in from the app shell and does not CSS-tween width', () => {
    expect(appSrc).toContain("playMotion('sidebar-in'");
    expect(appSrc).toContain('shouldPlaySidebarIn');
    expect(globalCss).not.toMatch(/\.app__sidebar\s*\{[^}]*transition:\s*width/s);
  });
});
