import type {
  AppLicenseState,
  LicenseStatus,
  ActiveLicense,
  StoredTrialData,
  StoredLicenseData,
} from './types.js';
import { getTrialState, isTrialActive, isTrialExpired } from './trial.js';

/**
 * Determines if license updates have expired
 *
 * @param updatesUntil - ISO 8601 date string
 * @param now - Current date (for testing)
 * @returns True if updates have expired
 */
function areUpdatesExpired(updatesUntil: string, now: Date): boolean {
  const expiryDate = new Date(updatesUntil);
  return now > expiryDate;
}

/**
 * Converts stored license data to active license info
 *
 * @param data - Stored license data
 * @param now - Current date (for testing)
 * @returns Active license info
 */
function toActiveLicense(
  data: StoredLicenseData,
  now: Date
): ActiveLicense {
  const { license } = data;
  return {
    licenseId: license.licenseId,
    issuedTo: license.issuedTo,
    purchaseDate: license.purchaseDate,
    updatesUntil: license.updatesUntil,
    plan: license.plan,
    capabilities: license.capabilities,
    updatesExpired: areUpdatesExpired(license.updatesUntil, now),
  };
}

/**
 * Determines the current license status
 *
 * @param trialData - Stored trial data
 * @param licenseData - Stored license data
 * @param now - Current date (for testing)
 * @returns Current license status
 */
function determineStatus(
  trialData: StoredTrialData | null,
  licenseData: StoredLicenseData | null,
  now: Date
): LicenseStatus {
  // If we have a valid license, that takes precedence
  if (licenseData) {
    const expired = areUpdatesExpired(licenseData.license.updatesUntil, now);
    return expired ? 'active_expired' : 'active';
  }

  // Check trial status
  const trial = getTrialState(trialData, now);

  if (isTrialActive(trial)) {
    return 'trial';
  }

  if (isTrialExpired(trial)) {
    return 'unlicensed';
  }

  // No trial started yet = trial (will start on first use)
  // This is a design choice: we auto-start trial
  return 'trial';
}

/**
 * Computes the full application license state
 *
 * @param trialData - Stored trial data
 * @param licenseData - Stored license data
 * @param now - Current date (for testing)
 * @returns Full application license state
 */
export function computeLicenseState(
  trialData: StoredTrialData | null,
  licenseData: StoredLicenseData | null,
  now: Date = new Date()
): AppLicenseState {
  const status = determineStatus(trialData, licenseData, now);

  const result: AppLicenseState = { status };

  // Add trial info if relevant
  if (trialData) {
    const trial = getTrialState(trialData, now);
    if (trial) {
      return {
        ...result,
        trial,
      };
    }
  }

  // Add license info if we have it
  if (licenseData) {
    return {
      ...result,
      license: toActiveLicense(licenseData, now),
    };
  }

  return result;
}

/**
 * Creates an unlicensed state
 */
export function createUnlicensedState(): AppLicenseState {
  return { status: 'unlicensed' };
}

/**
 * Creates a trial state
 *
 * @param trialData - Trial data
 * @param now - Current date (for testing)
 */
export function createTrialState(
  trialData: StoredTrialData,
  now: Date = new Date()
): AppLicenseState {
  const trial = getTrialState(trialData, now);
  if (!trial || trial.isExpired) {
    return { status: 'unlicensed' };
  }
  return { status: 'trial', trial };
}

/**
 * Checks if user needs to start a trial
 *
 * @param trialData - Stored trial data
 * @param licenseData - Stored license data
 * @returns True if trial should be started
 */
export function needsTrialStart(
  trialData: StoredTrialData | null,
  licenseData: StoredLicenseData | null
): boolean {
  // Already have a license
  if (licenseData) {
    return false;
  }

  // Trial already started
  if (trialData) {
    return false;
  }

  // Need to start trial
  return true;
}
