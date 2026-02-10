// Types (subscription model)
export type {
  Capability,
  LicenseStatus,
  BillingInterval,
  TrialState,
  SubscriptionInfo,
  AppLicenseState,
  StoredTrialData,
  StoredSubscriptionData,
  VerificationResult,
  // Legacy types (deprecated)
  LicenseFile,
  ActiveLicense,
  ValidationResult,
  StoredLicenseData,
  PublicKeyConfig,
} from './types.js';

// Validation (legacy - kept for backwards compatibility)
export { validateLicense, parseLicenseFile, signLicense, generateKeyPair } from './validator.js';

// Subscription verification
export {
  isSubscriptionActive,
  isCachedSubscriptionValid,
  createStoredSubscription,
  verifySubscription,
} from './validator.js';

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
  FREE_CAPABILITIES,
  PRO_CAPABILITIES,
  // Legacy alias
  UNLICENSED_CAPABILITIES,
  hasCapability,
  getAvailableCapabilities,
  getLockedCapabilities,
  hasFullAccess,
  shouldShowUpgradeBanner,
  shouldShowRenewalNotice,
  isTrialEndingSoon,
} from './capabilities.js';

// Updates
export type { UpdateEligibility, ReleaseInfo } from './updates.js';
export {
  checkUpdateEligibility,
  isSubscriptionEndingSoon,
  getDaysUntilPeriodEnd,
  getUpdateStatusMessage,
  // Legacy functions (deprecated - always return false/null)
  isUpdatesExpiringSoon,
  getDaysUntilUpdatesExpire,
} from './updates.js';

// Storage (legacy - kept for backwards compatibility)
export type { LicenseStorage } from './storage.js';
export {
  InMemoryLicenseStorage,
  createStoredLicenseData,
  isStoredLicenseDataValid,
} from './storage.js';

// State
export {
  computeLicenseState,
  createFreeState,
  createTrialState,
  canStartTrial,
  // Legacy aliases (deprecated)
  createUnlicensedState,
  needsTrialStart,
} from './state.js';
