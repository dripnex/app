import { describe, it, expect } from 'vitest';
import {
  hasCapability,
  getAvailableCapabilities,
  getLockedCapabilities,
  hasFullAccess,
  shouldShowUpgradeBanner,
  shouldShowRenewalNotice,
  ALL_CAPABILITIES,
  UNLICENSED_CAPABILITIES,
} from '../src/capabilities.js';
import type { AppLicenseState, Capability } from '../src/types.js';

describe('capabilities', () => {
  describe('hasCapability', () => {
    it('trial has all capabilities', () => {
      const state: AppLicenseState = { status: 'trial' };

      for (const cap of ALL_CAPABILITIES) {
        expect(hasCapability(cap, state)).toBe(true);
      }
    });

    it('unlicensed has only basic capabilities', () => {
      const state: AppLicenseState = { status: 'unlicensed' };

      expect(hasCapability('notes.basic', state)).toBe(true);
      expect(hasCapability('search.basic', state)).toBe(true);
      expect(hasCapability('export.markdown', state)).toBe(true);

      expect(hasCapability('notes.unlimited', state)).toBe(false);
      expect(hasCapability('links.backlinks', state)).toBe(false);
      expect(hasCapability('graph.view', state)).toBe(false);
    });

    it('active license has its capabilities', () => {
      const state: AppLicenseState = {
        status: 'active',
        license: {
          licenseId: 'lic_123',
          issuedTo: 'test@example.com',
          purchaseDate: '2025-01-01',
          updatesUntil: '2026-01-01',
          plan: 'pro',
          capabilities: ['notes.basic', 'notes.unlimited', 'graph.view'],
          updatesExpired: false,
        },
      };

      expect(hasCapability('notes.basic', state)).toBe(true);
      expect(hasCapability('notes.unlimited', state)).toBe(true);
      expect(hasCapability('graph.view', state)).toBe(true);
      expect(hasCapability('links.backlinks', state)).toBe(false);
    });

    it('active_expired still has all capabilities', () => {
      const state: AppLicenseState = {
        status: 'active_expired',
        license: {
          licenseId: 'lic_123',
          issuedTo: 'test@example.com',
          purchaseDate: '2025-01-01',
          updatesUntil: '2025-06-01',
          plan: 'pro',
          capabilities: ALL_CAPABILITIES as Capability[],
          updatesExpired: true,
        },
      };

      // Features still work even after updates expire
      for (const cap of ALL_CAPABILITIES) {
        expect(hasCapability(cap, state)).toBe(true);
      }
    });
  });

  describe('getAvailableCapabilities', () => {
    it('trial returns all capabilities', () => {
      const state: AppLicenseState = { status: 'trial' };
      expect(getAvailableCapabilities(state)).toEqual(ALL_CAPABILITIES);
    });

    it('unlicensed returns basic capabilities', () => {
      const state: AppLicenseState = { status: 'unlicensed' };
      expect(getAvailableCapabilities(state)).toEqual(UNLICENSED_CAPABILITIES);
    });

    it('active returns license capabilities', () => {
      const caps: readonly Capability[] = ['notes.basic', 'graph.view'];
      const state: AppLicenseState = {
        status: 'active',
        license: {
          licenseId: 'lic_123',
          issuedTo: 'test@example.com',
          purchaseDate: '2025-01-01',
          updatesUntil: '2026-01-01',
          plan: 'pro',
          capabilities: caps,
          updatesExpired: false,
        },
      };
      expect(getAvailableCapabilities(state)).toEqual(caps);
    });
  });

  describe('getLockedCapabilities', () => {
    it('trial has no locked capabilities', () => {
      const state: AppLicenseState = { status: 'trial' };
      expect(getLockedCapabilities(state)).toEqual([]);
    });

    it('unlicensed has many locked capabilities', () => {
      const state: AppLicenseState = { status: 'unlicensed' };
      const locked = getLockedCapabilities(state);

      expect(locked).toContain('notes.unlimited');
      expect(locked).toContain('links.backlinks');
      expect(locked).toContain('graph.view');
      expect(locked).not.toContain('notes.basic');
    });
  });

  describe('hasFullAccess', () => {
    it('trial has full access', () => {
      expect(hasFullAccess({ status: 'trial' })).toBe(true);
    });

    it('active has full access', () => {
      expect(
        hasFullAccess({
          status: 'active',
          license: {
            licenseId: 'lic_123',
            issuedTo: 'test@example.com',
            purchaseDate: '2025-01-01',
            updatesUntil: '2026-01-01',
            plan: 'pro',
            capabilities: [],
            updatesExpired: false,
          },
        })
      ).toBe(true);
    });

    it('active_expired has full access', () => {
      expect(
        hasFullAccess({
          status: 'active_expired',
          license: {
            licenseId: 'lic_123',
            issuedTo: 'test@example.com',
            purchaseDate: '2025-01-01',
            updatesUntil: '2025-06-01',
            plan: 'pro',
            capabilities: [],
            updatesExpired: true,
          },
        })
      ).toBe(true);
    });

    it('unlicensed does not have full access', () => {
      expect(hasFullAccess({ status: 'unlicensed' })).toBe(false);
    });
  });

  describe('shouldShowUpgradeBanner', () => {
    it('shows for unlicensed', () => {
      expect(shouldShowUpgradeBanner({ status: 'unlicensed' })).toBe(true);
    });

    it('does not show for trial', () => {
      expect(shouldShowUpgradeBanner({ status: 'trial' })).toBe(false);
    });

    it('does not show for active', () => {
      expect(
        shouldShowUpgradeBanner({
          status: 'active',
          license: {
            licenseId: 'lic_123',
            issuedTo: 'test@example.com',
            purchaseDate: '2025-01-01',
            updatesUntil: '2026-01-01',
            plan: 'pro',
            capabilities: [],
            updatesExpired: false,
          },
        })
      ).toBe(false);
    });
  });

  describe('shouldShowRenewalNotice', () => {
    it('shows for active_expired', () => {
      expect(
        shouldShowRenewalNotice({
          status: 'active_expired',
          license: {
            licenseId: 'lic_123',
            issuedTo: 'test@example.com',
            purchaseDate: '2025-01-01',
            updatesUntil: '2025-06-01',
            plan: 'pro',
            capabilities: [],
            updatesExpired: true,
          },
        })
      ).toBe(true);
    });

    it('does not show for active', () => {
      expect(
        shouldShowRenewalNotice({
          status: 'active',
          license: {
            licenseId: 'lic_123',
            issuedTo: 'test@example.com',
            purchaseDate: '2025-01-01',
            updatesUntil: '2026-01-01',
            plan: 'pro',
            capabilities: [],
            updatesExpired: false,
          },
        })
      ).toBe(false);
    });

    it('does not show for unlicensed', () => {
      expect(shouldShowRenewalNotice({ status: 'unlicensed' })).toBe(false);
    });
  });
});
