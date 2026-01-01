import type {
  AppLicenseState,
  LicenseStatus,
  StoredTrialData,
  StoredSubscriptionData,
} from './types.js';
import { getTrialState, isTrialActive, isTrialExpired } from './trial.js';

/**
 * Checks if subscription has expired
 */
function isSubscriptionExpired(subscription: StoredSubscriptionData, now: Date): boolean {
  const periodEnd = new Date(subscription.subscription.currentPeriodEnd);
  return now > periodEnd;
}

/**
 * Determines the current license status
 */
function determineStatus(
  trialData: StoredTrialData | null,
  subscriptionData: StoredSubscriptionData | null,
  now: Date
): LicenseStatus {
  // If we have an active subscription
  if (subscriptionData) {
    const { status } = subscriptionData.subscription;

    if (status === 'active') {
      return 'pro_active';
    }

    if (status === 'past_due') {
      return 'pro_grace';
    }

    if (status === 'canceled' || status === 'paused') {
      // Check if still within paid period
      if (!isSubscriptionExpired(subscriptionData, now)) {
        return 'pro_active'; // Still paid until period end
      }
      return 'pro_expired';
    }
  }

  // Check trial status
  const trial = getTrialState(trialData, now);

  if (isTrialActive(trial)) {
    return 'trial';
  }

  if (isTrialExpired(trial)) {
    return 'free';
  }

  // No trial started yet = free (can start trial anytime)
  return 'free';
}

/**
 * Computes the full application license state
 */
export function computeLicenseState(
  trialData: StoredTrialData | null,
  subscriptionData: StoredSubscriptionData | null,
  now: Date = new Date()
): AppLicenseState {
  const status = determineStatus(trialData, subscriptionData, now);

  const result: AppLicenseState = { status };

  // Add trial info if in trial
  if (status === 'trial' && trialData) {
    const trial = getTrialState(trialData, now);
    if (trial) {
      return { ...result, trial };
    }
  }

  // Add subscription info if we have it
  if (subscriptionData && (status === 'pro_active' || status === 'pro_grace')) {
    return {
      ...result,
      subscription: subscriptionData.subscription,
    };
  }

  return result;
}

/**
 * Creates a free tier state
 */
export function createFreeState(): AppLicenseState {
  return { status: 'free' };
}

/**
 * @deprecated Use createFreeState instead
 */
export function createUnlicensedState(): AppLicenseState {
  return createFreeState();
}

/**
 * Creates a trial state
 */
export function createTrialState(
  trialData: StoredTrialData,
  now: Date = new Date()
): AppLicenseState {
  const trial = getTrialState(trialData, now);
  if (!trial || trial.isExpired) {
    return { status: 'free' };
  }
  return { status: 'trial', trial };
}

/**
 * Checks if user can start a trial
 */
export function canStartTrial(
  trialData: StoredTrialData | null,
  subscriptionData: StoredSubscriptionData | null
): boolean {
  // Already has active subscription
  if (subscriptionData?.subscription.status === 'active') {
    return false;
  }

  // Trial already started
  if (trialData) {
    return false;
  }

  return true;
}

/**
 * @deprecated Use canStartTrial instead
 */
export function needsTrialStart(trialData: StoredTrialData | null, _licenseData: unknown): boolean {
  return canStartTrial(trialData, null);
}
