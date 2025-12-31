import { describe, it, expect } from 'vitest';
import {
  checkUpdateEligibility,
  isUpdatesExpiringSoon,
  getDaysUntilUpdatesExpire,
  getUpdateStatusMessage,
} from '../src/updates.js';
import type { AppLicenseState, Capability } from '../src/types.js';

const ALL_CAPS: Capability[] = [
  'notes.basic',
  'notes.unlimited',
  'links.backlinks',
  'search.basic',
  'search.advanced',
  'export.markdown',
  'export.structured',
  'import.folder',
  'import.obsidian',
  'themes.custom',
  'graph.view',
];

describe('updates', () => {
  describe('checkUpdateEligibility', () => {
    it('trial is always eligible', () => {
      const state: AppLicenseState = { status: 'trial' };
      const release = { version: '1.0.0', releaseDate: '2025-06-01' };

      const result = checkUpdateEligibility(release, state);
      expect(result.eligible).toBe(true);
      expect(result.reason).toBe('trial');
    });

    it('unlicensed is not eligible', () => {
      const state: AppLicenseState = { status: 'unlicensed' };
      const release = { version: '1.0.0', releaseDate: '2025-06-01' };

      const result = checkUpdateEligibility(release, state);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('unlicensed');
    });

    it('active license can update to release before updatesUntil', () => {
      const state: AppLicenseState = {
        status: 'active',
        license: {
          licenseId: 'lic_123',
          issuedTo: 'test@example.com',
          purchaseDate: '2025-01-01',
          updatesUntil: '2026-01-01',
          plan: 'pro',
          capabilities: ALL_CAPS,
          updatesExpired: false,
        },
      };
      const release = { version: '1.0.0', releaseDate: '2025-06-01' };

      const result = checkUpdateEligibility(release, state);
      expect(result.eligible).toBe(true);
      expect(result.reason).toBe('licensed');
    });

    it('active license can update to release on updatesUntil date', () => {
      const state: AppLicenseState = {
        status: 'active',
        license: {
          licenseId: 'lic_123',
          issuedTo: 'test@example.com',
          purchaseDate: '2025-01-01',
          updatesUntil: '2026-01-01',
          plan: 'pro',
          capabilities: ALL_CAPS,
          updatesExpired: false,
        },
      };
      const release = { version: '1.0.0', releaseDate: '2026-01-01' };

      const result = checkUpdateEligibility(release, state);
      expect(result.eligible).toBe(true);
      expect(result.reason).toBe('licensed');
    });

    it('active license cannot update to release after updatesUntil', () => {
      const state: AppLicenseState = {
        status: 'active',
        license: {
          licenseId: 'lic_123',
          issuedTo: 'test@example.com',
          purchaseDate: '2025-01-01',
          updatesUntil: '2026-01-01',
          plan: 'pro',
          capabilities: ALL_CAPS,
          updatesExpired: false,
        },
      };
      const release = { version: '2.0.0', releaseDate: '2026-06-01' };

      const result = checkUpdateEligibility(release, state);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('release_after_expiry');
    });

    it('active_expired can still update to releases before expiry', () => {
      const state: AppLicenseState = {
        status: 'active_expired',
        license: {
          licenseId: 'lic_123',
          issuedTo: 'test@example.com',
          purchaseDate: '2025-01-01',
          updatesUntil: '2026-01-01',
          plan: 'pro',
          capabilities: ALL_CAPS,
          updatesExpired: true,
        },
      };
      const release = { version: '1.0.0', releaseDate: '2025-12-01' };

      const result = checkUpdateEligibility(release, state);
      expect(result.eligible).toBe(true);
      expect(result.reason).toBe('licensed');
    });
  });

  describe('isUpdatesExpiringSoon', () => {
    it('returns false for trial', () => {
      expect(isUpdatesExpiringSoon({ status: 'trial' })).toBe(false);
    });

    it('returns false for unlicensed', () => {
      expect(isUpdatesExpiringSoon({ status: 'unlicensed' })).toBe(false);
    });

    it('returns true when expiring within 30 days', () => {
      const now = new Date('2025-12-15');
      const state: AppLicenseState = {
        status: 'active',
        license: {
          licenseId: 'lic_123',
          issuedTo: 'test@example.com',
          purchaseDate: '2025-01-01',
          updatesUntil: '2026-01-01',
          plan: 'pro',
          capabilities: ALL_CAPS,
          updatesExpired: false,
        },
      };

      expect(isUpdatesExpiringSoon(state, 30, now)).toBe(true);
    });

    it('returns false when not expiring soon', () => {
      const now = new Date('2025-06-01');
      const state: AppLicenseState = {
        status: 'active',
        license: {
          licenseId: 'lic_123',
          issuedTo: 'test@example.com',
          purchaseDate: '2025-01-01',
          updatesUntil: '2026-01-01',
          plan: 'pro',
          capabilities: ALL_CAPS,
          updatesExpired: false,
        },
      };

      expect(isUpdatesExpiringSoon(state, 30, now)).toBe(false);
    });

    it('returns false when already expired', () => {
      const now = new Date('2026-02-01');
      const state: AppLicenseState = {
        status: 'active_expired',
        license: {
          licenseId: 'lic_123',
          issuedTo: 'test@example.com',
          purchaseDate: '2025-01-01',
          updatesUntil: '2026-01-01',
          plan: 'pro',
          capabilities: ALL_CAPS,
          updatesExpired: true,
        },
      };

      expect(isUpdatesExpiringSoon(state, 30, now)).toBe(false);
    });
  });

  describe('getDaysUntilUpdatesExpire', () => {
    it('returns null for trial', () => {
      expect(getDaysUntilUpdatesExpire({ status: 'trial' })).toBeNull();
    });

    it('returns null for unlicensed', () => {
      expect(getDaysUntilUpdatesExpire({ status: 'unlicensed' })).toBeNull();
    });

    it('returns positive days when not expired', () => {
      const now = new Date('2025-06-01');
      const state: AppLicenseState = {
        status: 'active',
        license: {
          licenseId: 'lic_123',
          issuedTo: 'test@example.com',
          purchaseDate: '2025-01-01',
          updatesUntil: '2026-01-01',
          plan: 'pro',
          capabilities: ALL_CAPS,
          updatesExpired: false,
        },
      };

      const days = getDaysUntilUpdatesExpire(state, now);
      expect(days).toBeGreaterThan(0);
    });

    it('returns negative days when expired', () => {
      const now = new Date('2026-02-01');
      const state: AppLicenseState = {
        status: 'active_expired',
        license: {
          licenseId: 'lic_123',
          issuedTo: 'test@example.com',
          purchaseDate: '2025-01-01',
          updatesUntil: '2026-01-01',
          plan: 'pro',
          capabilities: ALL_CAPS,
          updatesExpired: true,
        },
      };

      const days = getDaysUntilUpdatesExpire(state, now);
      expect(days).toBeLessThan(0);
    });
  });

  describe('getUpdateStatusMessage', () => {
    it('trial message', () => {
      expect(getUpdateStatusMessage({ status: 'trial' })).toBe('Trial mode - updates included');
    });

    it('unlicensed message', () => {
      expect(getUpdateStatusMessage({ status: 'unlicensed' })).toBe(
        'Unlicensed - purchase to receive updates'
      );
    });

    it('active_expired message', () => {
      const state: AppLicenseState = {
        status: 'active_expired',
        license: {
          licenseId: 'lic_123',
          issuedTo: 'test@example.com',
          purchaseDate: '2025-01-01',
          updatesUntil: '2025-06-01',
          plan: 'pro',
          capabilities: ALL_CAPS,
          updatesExpired: true,
        },
      };
      expect(getUpdateStatusMessage(state)).toBe(
        'Update coverage expired - renew to get latest versions'
      );
    });

    it('active with expiring soon shows days', () => {
      const now = new Date('2025-12-25');
      const state: AppLicenseState = {
        status: 'active',
        license: {
          licenseId: 'lic_123',
          issuedTo: 'test@example.com',
          purchaseDate: '2025-01-01',
          updatesUntil: '2026-01-01',
          plan: 'pro',
          capabilities: ALL_CAPS,
          updatesExpired: false,
        },
      };

      const message = getUpdateStatusMessage(state, now);
      expect(message).toMatch(/Updates expire in \d+ days?/);
    });
  });
});
