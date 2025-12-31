// Types
export type {
  LicenseFile,
  Capability,
  LicenseStatus,
  TrialState,
  ActiveLicense,
  AppLicenseState,
  ValidationResult,
  StoredTrialData,
  StoredLicenseData,
  PublicKeyConfig,
} from './types.js';

// Validation
export { validateLicense, parseLicenseFile, signLicense, generateKeyPair } from './validator.js';

// Trial
export {
  TRIAL_DURATION_DAYS,
  calculateDaysRemaining,
  getTrialState,
  startTrial,
  isTrialActive,
  isTrialExpired,
  hasTrialStarted,
  getTrialEndDate,
} from './trial.js';

// Capabilities
export {
  ALL_CAPABILITIES,
  TRIAL_CAPABILITIES,
  UNLICENSED_CAPABILITIES,
  PRO_CAPABILITIES,
  hasCapability,
  getAvailableCapabilities,
  getLockedCapabilities,
  hasFullAccess,
  shouldShowUpgradeBanner,
  shouldShowRenewalNotice,
} from './capabilities.js';

// Updates
export type { UpdateEligibility, ReleaseInfo } from './updates.js';
export {
  checkUpdateEligibility,
  isUpdatesExpiringSoon,
  getDaysUntilUpdatesExpire,
  getUpdateStatusMessage,
} from './updates.js';

// Storage
export type { LicenseStorage } from './storage.js';
export {
  InMemoryLicenseStorage,
  createStoredLicenseData,
  isStoredLicenseDataValid,
} from './storage.js';

// State
export {
  computeLicenseState,
  createUnlicensedState,
  createTrialState,
  needsTrialStart,
} from './state.js';
