import type { AppLicenseState } from './types.js';

/**
 * Result of update eligibility check
 */
export interface UpdateEligibility {
  readonly eligible: boolean;
  readonly reason:
    | 'licensed'
    | 'trial'
    | 'updates_expired'
    | 'unlicensed'
    | 'release_after_expiry';
  readonly message?: string;
}

/**
 * Version info from a release
 */
export interface ReleaseInfo {
  readonly version: string;
  readonly releaseDate: string; // ISO 8601
}

/**
 * Checks if user is eligible to install a specific update
 *
 * @param release - The release to check eligibility for
 * @param state - Current license state
 * @returns Update eligibility result
 */
export function checkUpdateEligibility(
  release: ReleaseInfo,
  state: AppLicenseState
): UpdateEligibility {
  // Trial users can always update
  if (state.status === 'trial') {
    return {
      eligible: true,
      reason: 'trial',
    };
  }

  // Unlicensed users cannot update
  if (state.status === 'unlicensed') {
    return {
      eligible: false,
      reason: 'unlicensed',
      message: 'Purchase a license to receive updates.',
    };
  }

  // Licensed users (active or active_expired)
  if (state.status === 'active' || state.status === 'active_expired') {
    if (!state.license) {
      return {
        eligible: false,
        reason: 'unlicensed',
        message: 'License data not found.',
      };
    }

    const releaseDate = new Date(release.releaseDate);
    const updatesUntil = new Date(state.license.updatesUntil);

    // Check if release date is before or on the updatesUntil date
    if (releaseDate <= updatesUntil) {
      return {
        eligible: true,
        reason: 'licensed',
      };
    }

    // Release is after license coverage expired
    return {
      eligible: false,
      reason: 'release_after_expiry',
      message: `This version was released after your update coverage expired. Renew to get updates.`,
    };
  }

  // Fallback
  return {
    eligible: false,
    reason: 'unlicensed',
    message: 'Unknown license state.',
  };
}

/**
 * Checks if updates are expiring soon (within 30 days)
 *
 * @param state - Current license state
 * @param warningDays - Days before expiry to warn (default 30)
 * @param now - Current date (for testing)
 * @returns True if updates are expiring soon
 */
export function isUpdatesExpiringSoon(
  state: AppLicenseState,
  warningDays: number = 30,
  now: Date = new Date()
): boolean {
  if (state.status !== 'active' || !state.license) {
    return false;
  }

  const updatesUntil = new Date(state.license.updatesUntil);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.floor(
    (updatesUntil.getTime() - now.getTime()) / msPerDay
  );

  return daysRemaining > 0 && daysRemaining <= warningDays;
}

/**
 * Gets number of days until updates expire
 *
 * @param state - Current license state
 * @param now - Current date (for testing)
 * @returns Days until expiry (negative if already expired, null if not licensed)
 */
export function getDaysUntilUpdatesExpire(
  state: AppLicenseState,
  now: Date = new Date()
): number | null {
  if (
    (state.status !== 'active' && state.status !== 'active_expired') ||
    !state.license
  ) {
    return null;
  }

  const updatesUntil = new Date(state.license.updatesUntil);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((updatesUntil.getTime() - now.getTime()) / msPerDay);
}

/**
 * Formats a user-friendly message about update status
 *
 * @param state - Current license state
 * @param now - Current date (for testing)
 * @returns Human-readable status message
 */
export function getUpdateStatusMessage(
  state: AppLicenseState,
  now: Date = new Date()
): string {
  switch (state.status) {
    case 'trial':
      return 'Trial mode - updates included';

    case 'unlicensed':
      return 'Unlicensed - purchase to receive updates';

    case 'active': {
      const days = getDaysUntilUpdatesExpire(state, now);
      if (days !== null && days <= 30) {
        return `Updates expire in ${days} day${days !== 1 ? 's' : ''}`;
      }
      return 'Updates included';
    }

    case 'active_expired':
      return 'Update coverage expired - renew to get latest versions';

    default:
      return 'Unknown status';
  }
}
