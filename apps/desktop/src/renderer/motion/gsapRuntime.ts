/**
 * GSAP runtime for chrome events.
 * Reduced motion and Performance → Low skip movement and snap to the end state.
 */

import gsap from 'gsap';
import { LIST_ENTER_STAGGER_CAP } from './listEnter';

export type MotionEventName =
  | 'toast-in'
  | 'toast-out'
  | 'palette-in'
  | 'panel-in'
  | 'list-in'
  | 'list-select'
  | 'welcome-in'
  | 'gate-in'
  | 'sidebar-in';

export interface MotionPlayOptions {
  onComplete?: () => void;
}

const EASE_OUT = 'power2.out';
const LIST_ENTER_MS = 160;
const LIST_SELECT_MS = 140;
const LIST_STAGGER_MS = 16;

let scale = 1;
let reducedMotion = false;
let performanceLow = false;
let bound = false;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function shouldAnimate(): boolean {
  if (reducedMotion || prefersReducedMotion()) return false;
  if (performanceLow) return false;
  if (scale <= 0) return false;
  return true;
}

export function scaledDuration(baseMs: number): number {
  const n = Number.isFinite(scale) ? Math.min(2, Math.max(0, scale)) : 1;
  return (baseMs / 1000) * n;
}

export function setMotionScale(next: number): void {
  scale = Number.isFinite(next) ? Math.min(2, Math.max(0, next)) : 1;
  gsap.globalTimeline.timeScale(scale <= 0 ? 100 : 1);
}

export function setPerformanceLow(next: boolean): void {
  performanceLow = next;
}

export function initGsapRuntime(): () => void {
  reducedMotion = prefersReducedMotion();
  gsap.ticker.lagSmoothing(500, 33);
  if (typeof window === 'undefined') return () => undefined;

  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onChange = () => {
    reducedMotion = media.matches;
  };
  media.addEventListener('change', onChange);

  if (!bound) {
    bound = true;
    window.addEventListener('dripnex:motion', onMotionEvent as EventListener);
  }

  return () => {
    media.removeEventListener('change', onChange);
  };
}

function onMotionEvent(event: Event): void {
  const detail = (event as CustomEvent<{ name?: MotionEventName; target?: Element | null }>).detail;
  if (!detail?.name || !detail.target) return;
  playMotion(detail.name, detail.target);
}

export function playMotion(
  name: MotionEventName,
  target: Element | null | undefined,
  options: MotionPlayOptions = {}
): gsap.core.Tween | null {
  if (!target) {
    options.onComplete?.();
    return null;
  }

  gsap.killTweensOf(target);

  if (!shouldAnimate()) {
    gsap.set(target, { opacity: name === 'toast-out' ? 0 : 1, x: 0, y: 0, scale: 1 });
    options.onComplete?.();
    return null;
  }

  const ease = EASE_OUT;

  if (name === 'toast-in') {
    return gsap.fromTo(
      target,
      { opacity: 0, x: 12 },
      { opacity: 1, x: 0, duration: scaledDuration(150), ease, onComplete: options.onComplete }
    );
  }
  if (name === 'toast-out') {
    return gsap.to(target, {
      opacity: 0,
      x: 12,
      duration: scaledDuration(120),
      ease: 'power2.in',
      onComplete: options.onComplete,
    });
  }
  if (name === 'palette-in') {
    return gsap.fromTo(
      target,
      { opacity: 0, y: -8, scale: 0.98 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: scaledDuration(150),
        ease,
        onComplete: options.onComplete,
      }
    );
  }
  if (name === 'list-in') {
    return gsap.fromTo(
      target,
      { opacity: 0, y: 8 },
      {
        opacity: 1,
        y: 0,
        duration: scaledDuration(LIST_ENTER_MS),
        ease,
        onComplete: options.onComplete,
      }
    );
  }
  if (name === 'list-select') {
    return gsap.fromTo(
      target,
      { x: 6 },
      { x: 0, duration: scaledDuration(LIST_SELECT_MS), ease, onComplete: options.onComplete }
    );
  }
  if (name === 'sidebar-in') {
    return gsap.fromTo(
      target,
      { opacity: 0, x: -8 },
      {
        opacity: 1,
        x: 0,
        duration: scaledDuration(180),
        ease,
        onComplete: options.onComplete,
      }
    );
  }
  if (name === 'welcome-in' || name === 'gate-in') {
    return gsap.fromTo(
      target,
      { opacity: 0, y: 8 },
      {
        opacity: 1,
        y: 0,
        duration: scaledDuration(180),
        ease,
        onComplete: options.onComplete,
      }
    );
  }
  return gsap.fromTo(
    target,
    { opacity: 0, x: 12 },
    { opacity: 1, x: 0, duration: scaledDuration(180), ease, onComplete: options.onComplete }
  );
}

/** Staggered note-list enter. Caps delay so a long list does not take over the pane. */
export function playListEnter(targets: ArrayLike<Element> | Element[]): gsap.core.Tween | null {
  const list = Array.from(targets);
  if (list.length === 0) return null;

  gsap.killTweensOf(list);

  if (!shouldAnimate()) {
    gsap.set(list, { opacity: 1, x: 0, y: 0 });
    return null;
  }

  const animated = list.slice(0, LIST_ENTER_STAGGER_CAP + 1);
  const rest = list.slice(LIST_ENTER_STAGGER_CAP + 1);
  if (rest.length > 0) gsap.set(rest, { opacity: 1, x: 0, y: 0 });

  return gsap.fromTo(
    animated,
    { opacity: 0, y: 8 },
    {
      opacity: 1,
      y: 0,
      duration: scaledDuration(LIST_ENTER_MS),
      ease: EASE_OUT,
      stagger: scaledDuration(LIST_STAGGER_MS),
    }
  );
}
