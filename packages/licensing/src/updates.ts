import type { AppLicenseState } from './types.js';

/**
 * Result of update eligibility check
 */
export interface UpdateEligibility {
  readonly eligible: boolean;
  readonly reason: 'subscribed' | 'trial' | 'free' | 'grace_period';
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
 * Checks if user is eligible to install updates
 * In subscription model: active subscribers always get updates
 */
export function checkUpdateEligibility(
  _release: ReleaseInfo,
  state: AppLicenseState
): UpdateEligibility {
  switch (state.status) {
    case 'trial':
      return {
        eligible: true,
        reason: 'trial',
        message: 'Trial includes all updates',
      };

    case 'pro_active':
      return {
        eligible: true,
        reason: 'subscribed',
        message: 'Your subscription includes all updates',
      };

    case 'pro_grace':
      return {
        eligible: true,
        reason: 'grace_period',
        message: 'Please update your payment method to continue receiving updates',
      };

    case 'free':
    case 'pro_expired':
      return {
        eligible: false,
        reason: 'free',
        message: 'Subscribe to Pro to receive updates',
      };

    default:
      return {
        eligible: false,
        reason: 'free',
        message: 'Unknown status',
      };
  }
}

/**
 * Checks if subscription is ending soon
 */
export function isSubscriptionEndingSoon(
  state: AppLicenseState,
  warningDays: number = 7,
  now: Date = new Date()
): boolean {
  if (state.status !== 'pro_active' || !state.subscription) {
    return false;
  }

  // Only warn if subscription is set to cancel at period end
  if (!state.subscription.cancelAtPeriodEnd) {
    return false;
  }

  const periodEnd = new Date(state.subscription.currentPeriodEnd);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.floor((periodEnd.getTime() - now.getTime()) / msPerDay);

  return daysRemaining > 0 && daysRemaining <= warningDays;
}

/**
 * Gets days until subscription period ends
 */
export function getDaysUntilPeriodEnd(
  state: AppLicenseState,
  now: Date = new Date()
): number | null {
  if (!state.subscription) {
    return null;
  }

  const periodEnd = new Date(state.subscription.currentPeriodEnd);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((periodEnd.getTime() - now.getTime()) / msPerDay);
}

/**
 * Formats a user-friendly message about subscription status
 */
export function getUpdateStatusMessage(state: AppLicenseState, now: Date = new Date()): string {
  switch (state.status) {
    case 'trial': {
      const days = state.trial?.daysRemaining ?? 0;
      return `Trial - ${days} day${days !== 1 ? 's' : ''} remaining`;
    }

    case 'pro_active': {
      if (state.subscription?.cancelAtPeriodEnd) {
        const days = getDaysUntilPeriodEnd(state, now);
        return `Pro (canceling) - ${days} day${days !== 1 ? 's' : ''} remaining`;
      }
      return 'Pro - Updates included';
    }

    case 'pro_grace':
      return 'Pro - Payment required';

    case 'pro_expired':
      return 'Subscription ended - using Free tier';

    case 'free':
      return 'Free tier - Subscribe to Pro for updates';

    default:
      return 'Unknown status';
  }
}

// ============================================
// LEGACY EXPORTS (for backwards compatibility)
// ============================================

/**
 * @deprecated No longer relevant in subscription model
 */
export function isUpdatesExpiringSoon(
  _state: AppLicenseState,
  _warningDays?: number,
  _now?: Date
): boolean {
  return false;
}

/**
 * @deprecated No longer relevant in subscription model
 */
export function getDaysUntilUpdatesExpire(_state: AppLicenseState, _now?: Date): number | null {
  return null;
}
