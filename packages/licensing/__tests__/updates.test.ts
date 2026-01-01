import { describe, it, expect } from 'vitest';
import {
  checkUpdateEligibility,
  isSubscriptionEndingSoon,
  getDaysUntilPeriodEnd,
  getUpdateStatusMessage,
  isUpdatesExpiringSoon,
  getDaysUntilUpdatesExpire,
} from '../src/updates.js';
import type { AppLicenseState, SubscriptionInfo } from '../src/types.js';

// Helper to create a subscription
const createSubscription = (overrides: Partial<SubscriptionInfo> = {}): SubscriptionInfo => ({
  subscriptionId: 'sub_123',
  customerId: 'cus_123',
  email: 'test@example.com',
  plan: 'monthly',
  status: 'active',
  currentPeriodStart: '2025-01-01',
  currentPeriodEnd: '2026-01-01',
  cancelAtPeriodEnd: false,
  ...overrides,
});

describe('updates', () => {
  describe('checkUpdateEligibility', () => {
    const release = { version: '1.0.0', releaseDate: '2025-06-01' };

    it('trial is always eligible', () => {
      const state: AppLicenseState = { status: 'trial' };

      const result = checkUpdateEligibility(release, state);
      expect(result.eligible).toBe(true);
      expect(result.reason).toBe('trial');
    });

    it('free is not eligible', () => {
      const state: AppLicenseState = { status: 'free' };

      const result = checkUpdateEligibility(release, state);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('free');
    });

    it('pro_active is always eligible', () => {
      const state: AppLicenseState = {
        status: 'pro_active',
        subscription: createSubscription(),
      };

      const result = checkUpdateEligibility(release, state);
      expect(result.eligible).toBe(true);
      expect(result.reason).toBe('subscribed');
    });

    it('pro_grace is still eligible', () => {
      const state: AppLicenseState = {
        status: 'pro_grace',
        subscription: createSubscription({ status: 'past_due' }),
      };

      const result = checkUpdateEligibility(release, state);
      expect(result.eligible).toBe(true);
      expect(result.reason).toBe('grace_period');
    });

    it('pro_expired is not eligible', () => {
      const state: AppLicenseState = { status: 'pro_expired' };

      const result = checkUpdateEligibility(release, state);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('free');
    });
  });

  describe('isSubscriptionEndingSoon', () => {
    it('returns false for free', () => {
      expect(isSubscriptionEndingSoon({ status: 'free' })).toBe(false);
    });

    it('returns false for trial', () => {
      expect(isSubscriptionEndingSoon({ status: 'trial' })).toBe(false);
    });

    it('returns false when subscription is auto-renewing', () => {
      const now = new Date('2025-12-28');
      const state: AppLicenseState = {
        status: 'pro_active',
        subscription: createSubscription({
          currentPeriodEnd: '2026-01-01',
          cancelAtPeriodEnd: false, // Will auto-renew
        }),
      };

      expect(isSubscriptionEndingSoon(state, 7, now)).toBe(false);
    });

    it('returns true when subscription is canceling and within warning period', () => {
      const now = new Date('2025-12-28');
      const state: AppLicenseState = {
        status: 'pro_active',
        subscription: createSubscription({
          currentPeriodEnd: '2026-01-01',
          cancelAtPeriodEnd: true, // Set to cancel
        }),
      };

      expect(isSubscriptionEndingSoon(state, 7, now)).toBe(true);
    });

    it('returns false when subscription is canceling but not within warning period', () => {
      const now = new Date('2025-06-01');
      const state: AppLicenseState = {
        status: 'pro_active',
        subscription: createSubscription({
          currentPeriodEnd: '2026-01-01',
          cancelAtPeriodEnd: true,
        }),
      };

      expect(isSubscriptionEndingSoon(state, 7, now)).toBe(false);
    });
  });

  describe('getDaysUntilPeriodEnd', () => {
    it('returns null for free', () => {
      expect(getDaysUntilPeriodEnd({ status: 'free' })).toBeNull();
    });

    it('returns null for trial without subscription', () => {
      expect(getDaysUntilPeriodEnd({ status: 'trial' })).toBeNull();
    });

    it('returns positive days when subscription is active', () => {
      const now = new Date('2025-06-01');
      const state: AppLicenseState = {
        status: 'pro_active',
        subscription: createSubscription({
          currentPeriodEnd: '2026-01-01',
        }),
      };

      const days = getDaysUntilPeriodEnd(state, now);
      expect(days).toBeGreaterThan(0);
    });

    it('returns negative days when period has ended', () => {
      const now = new Date('2026-02-01');
      const state: AppLicenseState = {
        status: 'pro_active',
        subscription: createSubscription({
          currentPeriodEnd: '2026-01-01',
        }),
      };

      const days = getDaysUntilPeriodEnd(state, now);
      expect(days).toBeLessThan(0);
    });
  });

  describe('getUpdateStatusMessage', () => {
    it('trial message shows days remaining', () => {
      const state: AppLicenseState = {
        status: 'trial',
        trial: {
          startDate: '2025-01-01',
          daysRemaining: 10,
          isExpired: false,
        },
      };
      expect(getUpdateStatusMessage(state)).toBe('Trial - 10 days remaining');
    });

    it('trial message handles singular day', () => {
      const state: AppLicenseState = {
        status: 'trial',
        trial: {
          startDate: '2025-01-01',
          daysRemaining: 1,
          isExpired: false,
        },
      };
      expect(getUpdateStatusMessage(state)).toBe('Trial - 1 day remaining');
    });

    it('free message', () => {
      expect(getUpdateStatusMessage({ status: 'free' })).toBe(
        'Free tier - Subscribe to Pro for updates'
      );
    });

    it('pro_active message', () => {
      const state: AppLicenseState = {
        status: 'pro_active',
        subscription: createSubscription(),
      };
      expect(getUpdateStatusMessage(state)).toBe('Pro - Updates included');
    });

    it('pro_active canceling shows days remaining', () => {
      const now = new Date('2025-12-25');
      const state: AppLicenseState = {
        status: 'pro_active',
        subscription: createSubscription({
          currentPeriodEnd: '2026-01-01',
          cancelAtPeriodEnd: true,
        }),
      };

      const message = getUpdateStatusMessage(state, now);
      expect(message).toMatch(/Pro \(canceling\) - \d+ days? remaining/);
    });

    it('pro_grace message', () => {
      const state: AppLicenseState = {
        status: 'pro_grace',
        subscription: createSubscription({ status: 'past_due' }),
      };
      expect(getUpdateStatusMessage(state)).toBe('Pro - Payment required');
    });

    it('pro_expired message', () => {
      expect(getUpdateStatusMessage({ status: 'pro_expired' })).toBe(
        'Subscription ended - using Free tier'
      );
    });
  });

  describe('legacy functions (deprecated)', () => {
    it('isUpdatesExpiringSoon always returns false', () => {
      expect(isUpdatesExpiringSoon({ status: 'trial' })).toBe(false);
      expect(isUpdatesExpiringSoon({ status: 'free' })).toBe(false);
      expect(
        isUpdatesExpiringSoon({
          status: 'pro_active',
          subscription: createSubscription(),
        })
      ).toBe(false);
    });

    it('getDaysUntilUpdatesExpire always returns null', () => {
      expect(getDaysUntilUpdatesExpire({ status: 'trial' })).toBeNull();
      expect(getDaysUntilUpdatesExpire({ status: 'free' })).toBeNull();
      expect(
        getDaysUntilUpdatesExpire({
          status: 'pro_active',
          subscription: createSubscription(),
        })
      ).toBeNull();
    });
  });
});
