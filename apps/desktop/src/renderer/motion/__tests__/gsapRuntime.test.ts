import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import gsap from 'gsap';
import {
  playMotion,
  scaledDuration,
  setMotionScale,
  setPerformanceLow,
  shouldAnimate,
} from '../gsapRuntime';

describe('gsapRuntime', () => {
  beforeEach(() => {
    setMotionScale(1);
    setPerformanceLow(false);
  });

  afterEach(() => {
    gsap.globalTimeline.clear();
  });

  it('skips motion when scale is 0 or performance is low', () => {
    expect(shouldAnimate()).toBe(true);
    setMotionScale(0);
    expect(shouldAnimate()).toBe(false);
    setMotionScale(1);
    setPerformanceLow(true);
    expect(shouldAnimate()).toBe(false);
  });

  it('scales durations and clamps the multiplier', () => {
    setMotionScale(1);
    expect(scaledDuration(200)).toBeCloseTo(0.2);
    setMotionScale(2);
    expect(scaledDuration(200)).toBeCloseTo(0.4);
    setMotionScale(9);
    expect(scaledDuration(200)).toBeCloseTo(0.4);
  });

  it('keeps list and toast travel inside 6–12px', () => {
    const row = { opacity: 0, x: 0, y: 0, scale: 1 };
    const target = row as unknown as Element;

    const listIn = playMotion('list-in', target);
    expect(listIn?.vars.duration).toBeCloseTo(0.16);
    expect(listIn?.vars.y).toBe(0);
    gsap.killTweensOf(row);

    const select = playMotion('list-select', target);
    expect(select?.vars.duration).toBeCloseTo(0.14);
    expect(select?.vars.x).toBe(0);
    gsap.killTweensOf(row);

    const toast = playMotion('toast-in', target);
    expect(toast?.vars.duration).toBeCloseTo(0.15);
    expect(toast?.vars.x).toBe(0);
    gsap.killTweensOf(row);

    const welcome = playMotion('welcome-in', target);
    expect(welcome?.vars.duration).toBeCloseTo(0.18);
    expect(welcome?.vars.y).toBe(0);
    gsap.killTweensOf(row);

    const gate = playMotion('gate-in', target);
    expect(gate?.vars.duration).toBeCloseTo(0.18);
    expect(gate?.vars.y).toBe(0);
    gsap.killTweensOf(row);

    const sidebar = playMotion('sidebar-in', target);
    expect(sidebar?.vars.duration).toBeCloseTo(0.18);
    expect(sidebar?.vars.x).toBe(0);
    gsap.killTweensOf(row);
  });

  it('snaps gate-in when Performance is Low', () => {
    setPerformanceLow(true);
    const card = { opacity: 0, x: 0, y: 8, scale: 1 };
    expect(playMotion('gate-in', card as unknown as Element)).toBeNull();
    expect(card.opacity).toBe(1);
    expect(card.y).toBe(0);
  });
});
