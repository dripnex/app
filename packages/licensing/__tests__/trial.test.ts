import { describe, it, expect } from 'vitest';
import {
  TRIAL_DURATION_DAYS,
  calculateDaysRemaining,
  getTrialState,
  startTrial,
  isTrialActive,
  isTrialExpired,
  hasTrialStarted,
  getTrialEndDate,
} from '../src/trial.js';
import type { StoredTrialData } from '../src/types.js';

describe('trial', () => {
  describe('TRIAL_DURATION_DAYS', () => {
    it('should be 14 days', () => {
      expect(TRIAL_DURATION_DAYS).toBe(14);
    });
  });

  describe('calculateDaysRemaining', () => {
    it('returns full duration on day 1', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const now = new Date('2025-01-01T12:00:00Z');
      expect(calculateDaysRemaining(start, now)).toBe(14);
    });

    it('returns 13 days after 1 day', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const now = new Date('2025-01-02T00:00:00Z');
      expect(calculateDaysRemaining(start, now)).toBe(13);
    });

    it('returns 0 when expired', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const now = new Date('2025-01-20T00:00:00Z');
      expect(calculateDaysRemaining(start, now)).toBe(0);
    });

    it('returns 0 not negative when well past expiry', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const now = new Date('2025-06-01T00:00:00Z');
      expect(calculateDaysRemaining(start, now)).toBe(0);
    });

    it('returns 1 on last day', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const now = new Date('2025-01-14T00:00:00Z');
      expect(calculateDaysRemaining(start, now)).toBe(1);
    });
  });

  describe('getTrialState', () => {
    it('returns null for null data', () => {
      expect(getTrialState(null)).toBeNull();
    });

    it('returns null for invalid date', () => {
      const data: StoredTrialData = { startDate: 'invalid-date' };
      expect(getTrialState(data)).toBeNull();
    });

    it('returns active trial state', () => {
      const now = new Date('2025-01-05T00:00:00Z');
      const data: StoredTrialData = { startDate: '2025-01-01T00:00:00Z' };
      const state = getTrialState(data, now);

      expect(state).not.toBeNull();
      expect(state?.daysRemaining).toBe(10);
      expect(state?.isExpired).toBe(false);
    });

    it('returns expired trial state', () => {
      const now = new Date('2025-01-20T00:00:00Z');
      const data: StoredTrialData = { startDate: '2025-01-01T00:00:00Z' };
      const state = getTrialState(data, now);

      expect(state).not.toBeNull();
      expect(state?.daysRemaining).toBe(0);
      expect(state?.isExpired).toBe(true);
    });
  });

  describe('startTrial', () => {
    it('creates trial data with current date', () => {
      const now = new Date('2025-01-15T10:30:00Z');
      const data = startTrial(now);

      expect(data.startDate).toBe('2025-01-15T10:30:00.000Z');
    });
  });

  describe('isTrialActive', () => {
    it('returns false for null', () => {
      expect(isTrialActive(null)).toBe(false);
    });

    it('returns true for active trial', () => {
      expect(
        isTrialActive({
          startDate: '2025-01-01',
          daysRemaining: 10,
          isExpired: false,
        })
      ).toBe(true);
    });

    it('returns false for expired trial', () => {
      expect(
        isTrialActive({
          startDate: '2025-01-01',
          daysRemaining: 0,
          isExpired: true,
        })
      ).toBe(false);
    });
  });

  describe('isTrialExpired', () => {
    it('returns false for null (never started)', () => {
      expect(isTrialExpired(null)).toBe(false);
    });

    it('returns false for active trial', () => {
      expect(
        isTrialExpired({
          startDate: '2025-01-01',
          daysRemaining: 10,
          isExpired: false,
        })
      ).toBe(false);
    });

    it('returns true for expired trial', () => {
      expect(
        isTrialExpired({
          startDate: '2025-01-01',
          daysRemaining: 0,
          isExpired: true,
        })
      ).toBe(true);
    });
  });

  describe('hasTrialStarted', () => {
    it('returns false for null', () => {
      expect(hasTrialStarted(null)).toBe(false);
    });

    it('returns true for stored data', () => {
      expect(hasTrialStarted({ startDate: '2025-01-01' })).toBe(true);
    });
  });

  describe('getTrialEndDate', () => {
    it('calculates correct end date', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const end = getTrialEndDate(start);

      expect(end.toISOString()).toBe('2025-01-15T00:00:00.000Z');
    });
  });
});
