/**
 * Subscription-based licensing types
 * Freemium + Pro Subscription model
 */

/**
 * Features that can be enabled/disabled by plan
 */
export type Capability =
  | 'notes.basic' // create / edit / delete notes
  | 'notes.unlimited' // no note limit (both tiers have this)
  | 'search.basic' // simple search
  | 'search.advanced' // ranking, filters (Pro)
  | 'export.markdown' // export .md
  | 'export.structured' // export md + metadata (Pro)
  | 'import.folder' // import md folder
  | 'import.obsidian' // import Obsidian vault (Pro)
  | 'sync.cloud' // cloud sync across devices (Pro)
  | 'links.backlinks' // automatic backlinks (Pro)
  | 'themes.custom' // advanced theming (Pro)
  | 'graph.view'; // visual graph (Pro)

/**
 * Current subscription/license status
 */
export type LicenseStatus =
  | 'free' // Free tier, offline, no account
  | 'trial' // 14-day Pro trial
  | 'pro_active' // Active Pro subscription
  | 'pro_grace' // Grace period (subscription past due)
  | 'pro_expired'; // Subscription canceled/expired → back to Free

/**
 * Subscription billing interval
 */
export type BillingInterval = 'monthly' | 'annual';

/**
 * Trial state information
 */
export interface TrialState {
  readonly startDate: string; // ISO 8601
  readonly daysRemaining: number;
  readonly isExpired: boolean;
}

/**
 * Active subscription information
 */
export interface SubscriptionInfo {
  readonly subscriptionId: string;
  readonly customerId: string;
  readonly email: string;
  readonly plan: BillingInterval;
  readonly status: 'active' | 'past_due' | 'canceled' | 'paused';
  readonly currentPeriodStart: string; // ISO 8601
  readonly currentPeriodEnd: string; // ISO 8601
  readonly cancelAtPeriodEnd: boolean;
}

/**
 * Full application license state
 */
export interface AppLicenseState {
  readonly status: LicenseStatus;
  readonly trial?: TrialState;
  readonly subscription?: SubscriptionInfo;
}

/**
 * Stored trial data (persisted locally)
 */
export interface StoredTrialData {
  readonly startDate: string;
}

/**
 * Stored subscription data (cached locally)
 */
export interface StoredSubscriptionData {
  readonly subscription: SubscriptionInfo;
  readonly lastVerified: string; // ISO 8601
  readonly cacheExpiresAt: string; // ISO 8601
}

/**
 * Result of subscription verification
 */
export interface VerificationResult {
  readonly valid: boolean;
  readonly error?: string;
  readonly subscription?: SubscriptionInfo;
}

// ============================================
// LEGACY TYPES (kept for migration, will remove)
// ============================================

/**
 * @deprecated Use SubscriptionInfo instead
 * Legacy license file format - kept for backwards compatibility
 */
export interface LicenseFile {
  readonly licenseVersion: 1;
  readonly licenseId: string;
  readonly issuedTo: string;
  readonly purchaseDate: string;
  readonly updatesUntil: string;
  readonly plan: 'pro';
  readonly capabilities: readonly Capability[];
  readonly signature: string;
}

/**
 * @deprecated Use StoredSubscriptionData instead
 */
export interface StoredLicenseData {
  readonly license: LicenseFile;
  readonly activatedAt: string;
}

/**
 * @deprecated No longer needed for subscription model
 */
export interface ActiveLicense {
  readonly licenseId: string;
  readonly issuedTo: string;
  readonly purchaseDate: string;
  readonly updatesUntil: string;
  readonly plan: 'pro';
  readonly capabilities: readonly Capability[];
  readonly updatesExpired: boolean;
}

/**
 * @deprecated No longer needed for subscription model
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly error?: string;
  readonly license?: LicenseFile;
}

/**
 * @deprecated No longer needed for subscription model
 */
export interface PublicKeyConfig {
  readonly publicKey: string;
}
