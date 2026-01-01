import type { Capability, AppLicenseState } from './types.js';

/**
 * All available capabilities in the system
 */
export const ALL_CAPABILITIES: readonly Capability[] = [
  'notes.basic',
  'notes.unlimited',
  'search.basic',
  'search.advanced',
  'export.markdown',
  'export.structured',
  'import.folder',
  'import.obsidian',
  'sync.cloud',
  'links.backlinks',
  'themes.custom',
  'graph.view',
] as const;

/**
 * Capabilities available in Free tier (offline, no account)
 */
export const FREE_CAPABILITIES: readonly Capability[] = [
  'notes.basic',
  'notes.unlimited',
  'search.basic',
  'export.markdown',
  'import.folder',
] as const;

/**
 * Capabilities available during trial (all Pro features)
 */
export const TRIAL_CAPABILITIES: readonly Capability[] = ALL_CAPABILITIES;

/**
 * Capabilities available with Pro subscription
 */
export const PRO_CAPABILITIES: readonly Capability[] = ALL_CAPABILITIES;

/**
 * Checks if a capability is available in the current license state
 */
export function hasCapability(capability: Capability, state: AppLicenseState): boolean {
  switch (state.status) {
    case 'trial':
      return TRIAL_CAPABILITIES.includes(capability);

    case 'pro_active':
    case 'pro_grace':
      return PRO_CAPABILITIES.includes(capability);

    case 'free':
    case 'pro_expired':
      return FREE_CAPABILITIES.includes(capability);

    default:
      return false;
  }
}

/**
 * Gets all available capabilities for the current license state
 */
export function getAvailableCapabilities(state: AppLicenseState): readonly Capability[] {
  switch (state.status) {
    case 'trial':
      return TRIAL_CAPABILITIES;

    case 'pro_active':
    case 'pro_grace':
      return PRO_CAPABILITIES;

    case 'free':
    case 'pro_expired':
      return FREE_CAPABILITIES;

    default:
      return [];
  }
}

/**
 * Gets capabilities that would be unlocked by subscribing to Pro
 */
export function getLockedCapabilities(state: AppLicenseState): readonly Capability[] {
  const available = getAvailableCapabilities(state);
  return ALL_CAPABILITIES.filter(cap => !available.includes(cap));
}

/**
 * Checks if current state has full Pro access
 */
export function hasFullAccess(state: AppLicenseState): boolean {
  return state.status === 'trial' || state.status === 'pro_active' || state.status === 'pro_grace';
}

/**
 * Checks if upgrade banner should be shown
 */
export function shouldShowUpgradeBanner(state: AppLicenseState): boolean {
  return state.status === 'free' || state.status === 'pro_expired';
}

/**
 * Checks if subscription renewal notice should be shown
 */
export function shouldShowRenewalNotice(state: AppLicenseState): boolean {
  return state.status === 'pro_grace';
}

/**
 * Checks if trial is ending soon (< 3 days)
 */
export function isTrialEndingSoon(state: AppLicenseState): boolean {
  if (state.status !== 'trial' || !state.trial) {
    return false;
  }
  return state.trial.daysRemaining <= 3 && state.trial.daysRemaining > 0;
}

// ============================================
// LEGACY EXPORTS (for backwards compatibility)
// ============================================

/**
 * @deprecated Use FREE_CAPABILITIES instead
 */
export const UNLICENSED_CAPABILITIES = FREE_CAPABILITIES;
