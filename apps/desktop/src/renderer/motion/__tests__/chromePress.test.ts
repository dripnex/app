import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CHROME_HOVER_PX,
  CHROME_PRESS_ATTR,
  CHROME_PRESS_PX,
  CHROME_PRESS_SELECTOR,
  chromeMotionName,
  chromePressPhase,
} from '../chromePress';
import { playMotion, setMotionScale, setPerformanceLow } from '../gsapRuntime';

const here = dirname(fileURLToPath(import.meta.url));
const sidebarSrc = readFileSync(join(here, '../../components/sidebar/Sidebar.tsx'), 'utf8');
const filtersSrc = readFileSync(
  join(here, '../../components/sidebar/SidebarQuickFilters.tsx'),
  'utf8'
);
const statusSrc = readFileSync(join(here, '../../components/sidebar/StatusFilters.tsx'), 'utf8');
const tagsSrc = readFileSync(join(here, '../../components/sidebar/TagsList.tsx'), 'utf8');
const notebookSrc = readFileSync(join(here, '../../components/sidebar/NotebookItem.tsx'), 'utf8');

describe('chromePressPhase', () => {
  it('prefers press over hover', () => {
    expect(chromePressPhase(false, false)).toBe('rest');
    expect(chromePressPhase(true, false)).toBe('hover');
    expect(chromePressPhase(true, true)).toBe('press');
    expect(chromePressPhase(false, true)).toBe('press');
  });

  it('maps phases to motion names', () => {
    expect(chromeMotionName('hover')).toBe('chrome-hover');
    expect(chromeMotionName('press')).toBe('chrome-press');
    expect(chromeMotionName('rest')).toBe('chrome-rest');
  });

  it('targets data-chrome-press so CSS modules do not hide rows', () => {
    expect(CHROME_PRESS_ATTR).toBe('data-chrome-press');
    expect(CHROME_PRESS_SELECTOR).toBe('[data-chrome-press]');
    expect(CHROME_HOVER_PX).toBe(2);
    expect(CHROME_PRESS_PX).toBe(3);
  });
});

describe('chrome-press runtime', () => {
  afterEach(() => {
    setMotionScale(1);
    setPerformanceLow(false);
  });

  it('hovers 2px and presses 3px in 120–140ms', () => {
    const row = { opacity: 1, x: 0, y: 0, scale: 1 };
    const target = row as unknown as Element;

    const hover = playMotion('chrome-hover', target);
    expect(hover?.vars.duration).toBeCloseTo(0.14);
    expect(hover?.vars.x).toBe(CHROME_HOVER_PX);
    expect(hover?.vars.y).toBe(0);

    const press = playMotion('chrome-press', target);
    expect(press?.vars.duration).toBeCloseTo(0.12);
    expect(press?.vars.x).toBe(CHROME_PRESS_PX);

    const rest = playMotion('chrome-rest', target);
    expect(rest?.vars.duration).toBeCloseTo(0.14);
    expect(rest?.vars.x).toBe(0);
  });

  it('snaps when Performance is Low', () => {
    setPerformanceLow(true);
    const row = { opacity: 1, x: 6, y: 0, scale: 1 };
    expect(playMotion('chrome-hover', row as unknown as Element)).toBeNull();
    expect(row.x).toBe(0);
  });
});

describe('sidebar chrome wiring', () => {
  it('delegates GSAP chrome-press from the sidebar root onto marked rows', () => {
    expect(sidebarSrc).toContain('bindChromePress');
    expect(sidebarSrc).toContain('data-chrome-press');
    expect(filtersSrc).toContain('data-chrome-press');
    expect(statusSrc).toContain('data-chrome-press');
    expect(tagsSrc).toContain('data-chrome-press');
    expect(notebookSrc).toContain('data-chrome-press');
  });
});
