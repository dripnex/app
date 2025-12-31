import type { Capability, AppLicenseState } from './types.js';

/**
 * All available capabilities in the system
 */
export const ALL_CAPABILITIES: readonly Capability[] = [
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
] as const;

/**
 * Capabilities available during trial (all features)
 */
export const TRIAL_CAPABILITIES: readonly Capability[] = ALL_CAPABILITIES;

/**
 * Capabilities available in unlicensed mode (basic only)
 */
export const UNLICENSED_CAPABILITIES: readonly Capability[] = [
  'notes.basic',
  'search.basic',
  'export.markdown',
] as const;

/**
 * Full Pro capabilities (for reference when generating licenses)
 */
export const PRO_CAPABILITIES: readonly Capability[] = ALL_CAPABILITIES;

/**
 * Checks if a capability is available in the current license state
 *
 * @param capability - The capability to check
 * @param state - Current license state
 * @returns True if the capability is available
 */
export function hasCapability(
  capability: Capability,
  state: AppLicenseState
): boolean {
  switch (state.status) {
    case 'trial':
      // Trial has all features
      return TRIAL_CAPABILITIES.includes(capability);

    case 'active':
    case 'active_expired':
      // Licensed users have their capabilities forever
      // (active_expired only affects updates, not features)
      return state.license?.capabilities.includes(capability) ?? false;

    case 'unlicensed':
      // Only basic features
      return UNLICENSED_CAPABILITIES.includes(capability);

    default:
      return false;
  }
}

/**
 * Gets all available capabilities for the current license state
 *
 * @param state - Current license state
 * @returns Array of available capabilities
 */
export function getAvailableCapabilities(
  state: AppLicenseState
): readonly Capability[] {
  switch (state.status) {
    case 'trial':
      return TRIAL_CAPABILITIES;

    case 'active':
    case 'active_expired':
      return state.license?.capabilities ?? [];

    case 'unlicensed':
      return UNLICENSED_CAPABILITIES;

    default:
      return [];
  }
}

/**
 * Gets capabilities that would be unlocked by purchasing a license
 *
 * @param state - Current license state
 * @returns Array of capabilities that would be unlocked
 */
export function getLockedCapabilities(
  state: AppLicenseState
): readonly Capability[] {
  const available = getAvailableCapabilities(state);
  return ALL_CAPABILITIES.filter((cap) => !available.includes(cap));
}

/**
 * Checks if current state has full access (trial or licensed)
 *
 * @param state - Current license state
 * @returns True if user has full access
 */
export function hasFullAccess(state: AppLicenseState): boolean {
  return (
    state.status === 'trial' ||
    state.status === 'active' ||
    state.status === 'active_expired'
  );
}

/**
 * Checks if current state requires upgrade prompt
 *
 * @param state - Current license state
 * @returns True if upgrade banner should be shown
 */
export function shouldShowUpgradeBanner(state: AppLicenseState): boolean {
  return state.status === 'unlicensed';
}

/**
 * Checks if current state should show renewal prompt
 *
 * @param state - Current license state
 * @returns True if renewal notice should be shown
 */
export function shouldShowRenewalNotice(state: AppLicenseState): boolean {
  return state.status === 'active_expired';
}
