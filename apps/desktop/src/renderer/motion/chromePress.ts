import { playMotion, type MotionEventName } from './gsapRuntime';

/** Rows that play chrome-hover / chrome-press. CSS modules hash class names. */
export const CHROME_PRESS_ATTR = 'data-chrome-press';
export const CHROME_PRESS_SELECTOR = `[${CHROME_PRESS_ATTR}]`;

export const CHROME_HOVER_PX = 6;
export const CHROME_PRESS_PX = 8;

export type ChromePressPhase = 'hover' | 'press' | 'rest';

export function chromePressPhase(hovering: boolean, pressing: boolean): ChromePressPhase {
  if (pressing) return 'press';
  if (hovering) return 'hover';
  return 'rest';
}

export function chromeMotionName(phase: ChromePressPhase): MotionEventName {
  if (phase === 'hover') return 'chrome-hover';
  if (phase === 'press') return 'chrome-press';
  return 'chrome-rest';
}

export function chromeRowFromTarget(
  target: EventTarget | null,
  selector = CHROME_PRESS_SELECTOR
): Element | null {
  if (!(target instanceof Element)) return null;
  return target.closest(selector);
}

/** Delegate hover/press on `[data-chrome-press]` descendants. */
export function bindChromePress(
  root: Element | null,
  selector = CHROME_PRESS_SELECTOR
): () => void {
  if (!root) return () => undefined;

  let hoverRow: Element | null = null;
  let pressRow: Element | null = null;

  const play = (phase: ChromePressPhase, el: Element | null) => {
    if (el) playMotion(chromeMotionName(phase), el);
  };

  const onOver = (event: Event) => {
    const row = chromeRowFromTarget(event.target, selector);
    if (!row || row === hoverRow) return;
    if (hoverRow && hoverRow !== pressRow) play('rest', hoverRow);
    hoverRow = row;
    if (pressRow !== row) play('hover', row);
  };

  const onOut = (event: Event) => {
    const row = hoverRow;
    if (!row) return;
    const related = 'relatedTarget' in event ? event.relatedTarget : null;
    if (related instanceof Node && row.contains(related)) return;
    hoverRow = null;
    if (pressRow === row) return;
    play('rest', row);
  };

  const onDown = (event: Event) => {
    if ('button' in event && event.button !== 0) return;
    const row = chromeRowFromTarget(event.target, selector);
    if (!row) return;
    pressRow = row;
    play('press', row);
  };

  const onUp = () => {
    const row = pressRow;
    pressRow = null;
    if (!row) return;
    play(hoverRow === row ? 'hover' : 'rest', row);
  };

  root.addEventListener('pointerover', onOver);
  root.addEventListener('pointerout', onOut);
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointerup', onUp);
  root.addEventListener('pointercancel', onUp);

  return () => {
    root.removeEventListener('pointerover', onOver);
    root.removeEventListener('pointerout', onOut);
    root.removeEventListener('pointerdown', onDown);
    root.removeEventListener('pointerup', onUp);
    root.removeEventListener('pointercancel', onUp);
    if (pressRow) play('rest', pressRow);
    else if (hoverRow) play('rest', hoverRow);
  };
}
