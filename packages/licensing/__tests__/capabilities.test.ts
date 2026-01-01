import { describe, it, expect } from 'vitest';
import {
  hasCapability,
  getAvailableCapabilities,
  getLockedCapabilities,
  hasFullAccess,
  shouldShowUpgradeBanner,
  shouldShowRenewalNotice,
  isTrialEndingSoon,
  ALL_CAPABILITIES,
  FREE_CAPABILITIES,
  PRO_CAPABILITIES,
} from '../src/capabilities.js';
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

describe('capabilities', () => {
  describe('hasCapability', () => {
    it('trial has all capabilities', () => {
      const state: AppLicenseState = { status: 'trial' };

      for (const cap of ALL_CAPABILITIES) {
        expect(hasCapability(cap, state)).toBe(true);
      }
    });

    it('free has only basic capabilities', () => {
      const state: AppLicenseState = { status: 'free' };

      // Free tier capabilities
      expect(hasCapability('notes.basic', state)).toBe(true);
      expect(hasCapability('notes.unlimited', state)).toBe(true); // Free has unlimited local notes
      expect(hasCapability('search.basic', state)).toBe(true);
      expect(hasCapability('export.markdown', state)).toBe(true);
      expect(hasCapability('import.folder', state)).toBe(true);

      // Pro-only capabilities
      expect(hasCapability('sync.cloud', state)).toBe(false);
      expect(hasCapability('links.backlinks', state)).toBe(false);
      expect(hasCapability('graph.view', state)).toBe(false);
      expect(hasCapability('search.advanced', state)).toBe(false);
    });

    it('pro_active has all capabilities', () => {
      const state: AppLicenseState = {
        status: 'pro_active',
        subscription: createSubscription(),
      };

      for (const cap of ALL_CAPABILITIES) {
        expect(hasCapability(cap, state)).toBe(true);
      }
    });

    it('pro_grace still has all capabilities', () => {
      const state: AppLicenseState = {
        status: 'pro_grace',
        subscription: createSubscription({ status: 'past_due' }),
      };

      for (const cap of ALL_CAPABILITIES) {
        expect(hasCapability(cap, state)).toBe(true);
      }
    });

    it('pro_expired falls back to free capabilities', () => {
      const state: AppLicenseState = { status: 'pro_expired' };

      // Free tier capabilities still work
      expect(hasCapability('notes.basic', state)).toBe(true);
      expect(hasCapability('notes.unlimited', state)).toBe(true);

      // Pro capabilities are lost
      expect(hasCapability('sync.cloud', state)).toBe(false);
      expect(hasCapability('links.backlinks', state)).toBe(false);
      expect(hasCapability('graph.view', state)).toBe(false);
    });
  });

  describe('getAvailableCapabilities', () => {
    it('trial returns all capabilities', () => {
      const state: AppLicenseState = { status: 'trial' };
      expect(getAvailableCapabilities(state)).toEqual(ALL_CAPABILITIES);
    });

    it('free returns free capabilities', () => {
      const state: AppLicenseState = { status: 'free' };
      expect(getAvailableCapabilities(state)).toEqual(FREE_CAPABILITIES);
    });

    it('pro_active returns all capabilities', () => {
      const state: AppLicenseState = {
        status: 'pro_active',
        subscription: createSubscription(),
      };
      expect(getAvailableCapabilities(state)).toEqual(PRO_CAPABILITIES);
    });

    it('pro_grace returns all capabilities', () => {
      const state: AppLicenseState = {
        status: 'pro_grace',
        subscription: createSubscription({ status: 'past_due' }),
      };
      expect(getAvailableCapabilities(state)).toEqual(PRO_CAPABILITIES);
    });

    it('pro_expired returns free capabilities', () => {
      const state: AppLicenseState = { status: 'pro_expired' };
      expect(getAvailableCapabilities(state)).toEqual(FREE_CAPABILITIES);
    });
  });

  describe('getLockedCapabilities', () => {
    it('trial has no locked capabilities', () => {
      const state: AppLicenseState = { status: 'trial' };
      expect(getLockedCapabilities(state)).toEqual([]);
    });

    it('pro_active has no locked capabilities', () => {
      const state: AppLicenseState = {
        status: 'pro_active',
        subscription: createSubscription(),
      };
      expect(getLockedCapabilities(state)).toEqual([]);
    });

    it('free has pro-only capabilities locked', () => {
      const state: AppLicenseState = { status: 'free' };
      const locked = getLockedCapabilities(state);

      expect(locked).toContain('sync.cloud');
      expect(locked).toContain('links.backlinks');
      expect(locked).toContain('graph.view');
      expect(locked).toContain('search.advanced');
      expect(locked).not.toContain('notes.basic');
      expect(locked).not.toContain('notes.unlimited');
    });

    it('pro_expired has pro-only capabilities locked', () => {
      const state: AppLicenseState = { status: 'pro_expired' };
      const locked = getLockedCapabilities(state);

      expect(locked).toContain('sync.cloud');
      expect(locked).toContain('links.backlinks');
    });
  });

  describe('hasFullAccess', () => {
    it('trial has full access', () => {
      expect(hasFullAccess({ status: 'trial' })).toBe(true);
    });

    it('pro_active has full access', () => {
      expect(
        hasFullAccess({
          status: 'pro_active',
          subscription: createSubscription(),
        })
      ).toBe(true);
    });

    it('pro_grace has full access', () => {
      expect(
        hasFullAccess({
          status: 'pro_grace',
          subscription: createSubscription({ status: 'past_due' }),
        })
      ).toBe(true);
    });

    it('free does not have full access', () => {
      expect(hasFullAccess({ status: 'free' })).toBe(false);
    });

    it('pro_expired does not have full access', () => {
      expect(hasFullAccess({ status: 'pro_expired' })).toBe(false);
    });
  });

  describe('shouldShowUpgradeBanner', () => {
    it('shows for free', () => {
      expect(shouldShowUpgradeBanner({ status: 'free' })).toBe(true);
    });

    it('shows for pro_expired', () => {
      expect(shouldShowUpgradeBanner({ status: 'pro_expired' })).toBe(true);
    });

    it('does not show for trial', () => {
      expect(shouldShowUpgradeBanner({ status: 'trial' })).toBe(false);
    });

    it('does not show for pro_active', () => {
      expect(
        shouldShowUpgradeBanner({
          status: 'pro_active',
          subscription: createSubscription(),
        })
      ).toBe(false);
    });

    it('does not show for pro_grace', () => {
      expect(
        shouldShowUpgradeBanner({
          status: 'pro_grace',
          subscription: createSubscription({ status: 'past_due' }),
        })
      ).toBe(false);
    });
  });

  describe('shouldShowRenewalNotice', () => {
    it('shows for pro_grace (past due)', () => {
      expect(
        shouldShowRenewalNotice({
          status: 'pro_grace',
          subscription: createSubscription({ status: 'past_due' }),
        })
      ).toBe(true);
    });

    it('does not show for pro_active', () => {
      expect(
        shouldShowRenewalNotice({
          status: 'pro_active',
          subscription: createSubscription(),
        })
      ).toBe(false);
    });

    it('does not show for free', () => {
      expect(shouldShowRenewalNotice({ status: 'free' })).toBe(false);
    });

    it('does not show for pro_expired', () => {
      expect(shouldShowRenewalNotice({ status: 'pro_expired' })).toBe(false);
    });
  });

  describe('isTrialEndingSoon', () => {
    it('returns true when trial has 3 or fewer days left', () => {
      const state: AppLicenseState = {
        status: 'trial',
        trial: {
          startDate: '2025-01-01',
          daysRemaining: 2,
          isExpired: false,
        },
      };
      expect(isTrialEndingSoon(state)).toBe(true);
    });

    it('returns false when trial has more than 3 days left', () => {
      const state: AppLicenseState = {
        status: 'trial',
        trial: {
          startDate: '2025-01-01',
          daysRemaining: 10,
          isExpired: false,
        },
      };
      expect(isTrialEndingSoon(state)).toBe(false);
    });

    it('returns false for non-trial states', () => {
      expect(isTrialEndingSoon({ status: 'free' })).toBe(false);
      expect(isTrialEndingSoon({ status: 'pro_active' })).toBe(false);
    });

    it('returns false when trial is expired', () => {
      const state: AppLicenseState = {
        status: 'trial',
        trial: {
          startDate: '2025-01-01',
          daysRemaining: 0,
          isExpired: true,
        },
      };
      expect(isTrialEndingSoon(state)).toBe(false);
    });
  });
});
