import { describe, it, expect } from 'vitest';
import { getProductConfig } from '../src/facade.js';

describe('getProductConfig', () => {
  const config = getProductConfig();

  it('returns defined config', () => {
    expect(config).toBeDefined();
  });

  describe('trial', () => {
    it('has trialDays > 0', () => {
      expect(config.trialDays).toBeGreaterThan(0);
    });

    it('has trialDescription', () => {
      expect(config.trialDescription).toBeTruthy();
    });
  });

  describe('free plan', () => {
    it('has name "Free"', () => {
      expect(config.plans.free.name).toBe('Free');
    });

    it('has description', () => {
      expect(config.plans.free.description).toBeTruthy();
    });

    it('has features', () => {
      expect(config.plans.free.features.length).toBeGreaterThan(0);
    });

    it('has no pricing (free tier)', () => {
      expect(config.plans.free.pricing).toBeUndefined();
    });
  });

  describe('pro plan', () => {
    it('has name "Pro"', () => {
      expect(config.plans.pro.name).toBe('Pro');
    });

    it('has description', () => {
      expect(config.plans.pro.description).toBeTruthy();
    });

    it('has features', () => {
      expect(config.plans.pro.features.length).toBeGreaterThan(0);
    });

    it('has pricing defined', () => {
      expect(config.plans.pro.pricing).toBeDefined();
    });

    it('has monthly pricing with amountCents > 0', () => {
      expect(config.plans.pro.pricing?.intervals.monthly.amountCents).toBeGreaterThan(0);
    });

    it('has annual pricing with amountCents > 0', () => {
      expect(config.plans.pro.pricing?.intervals.annual.amountCents).toBeGreaterThan(0);
    });

    it('has annual savings percentage', () => {
      expect(config.plans.pro.pricing?.annualSavings).toBeTruthy();
    });
  });

  describe('guarantees', () => {
    it('has refund guarantee', () => {
      expect(config.guarantees.refund).toBeDefined();
      expect(config.guarantees.refund.description).toBeTruthy();
    });

    it('has noLockIn guarantee', () => {
      expect(config.guarantees.noLockIn).toBeDefined();
      expect(config.guarantees.noLockIn.description).toBeTruthy();
    });

    it('has freeTierForever guarantee', () => {
      expect(config.guarantees.freeTierForever).toBeDefined();
      expect(config.guarantees.freeTierForever.description).toBeTruthy();
    });

    it('has cancelAnytime guarantee', () => {
      expect(config.guarantees.cancelAnytime).toBeDefined();
      expect(config.guarantees.cancelAnytime.description).toBeTruthy();
    });
  });
});

describe('contract stability', () => {
  const config = getProductConfig();

  it('maintains stable plan IDs', () => {
    expect(Object.keys(config.plans)).toContain('free');
    expect(Object.keys(config.plans)).toContain('pro');
  });

  it('maintains stable billing intervals', () => {
    const intervals = config.plans.pro.pricing?.intervals;
    expect(intervals).toHaveProperty('monthly');
    expect(intervals).toHaveProperty('annual');
  });

  it('maintains stable guarantee IDs', () => {
    expect(Object.keys(config.guarantees)).toContain('refund');
    expect(Object.keys(config.guarantees)).toContain('noLockIn');
    expect(Object.keys(config.guarantees)).toContain('freeTierForever');
    expect(Object.keys(config.guarantees)).toContain('cancelAnytime');
  });
});
