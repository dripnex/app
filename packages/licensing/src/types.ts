/**
 * License file format as stored in license.json
 * Signed by Ed25519 for offline validation
 */
export interface LicenseFile {
  readonly licenseVersion: 1;
  readonly licenseId: string;
  readonly issuedTo: string;
  readonly purchaseDate: string; // ISO 8601
  readonly updatesUntil: string; // ISO 8601
  readonly plan: 'pro';
  readonly capabilities: readonly Capability[];
  readonly signature: string; // Base64 Ed25519 signature
}

/**
 * Features that can be enabled/disabled by license
 */
export type Capability =
  | 'notes.basic' // create / edit / delete notes
  | 'notes.unlimited' // no note limit
  | 'links.backlinks' // automatic backlinks
  | 'search.basic' // simple search
  | 'search.advanced' // ranking, filters
  | 'export.markdown' // export .md
  | 'export.structured' // export md + metadata
  | 'import.folder' // import md folder
  | 'import.obsidian' // import Obsidian vault
  | 'themes.custom' // advanced theming
  | 'graph.view'; // visual graph

/**
 * Current license status
 */
export type LicenseStatus =
  | 'trial' // 14-day trial, all features
  | 'active' // Valid license, updates included
  | 'active_expired' // Valid license, updates expired (app works!)
  | 'unlicensed'; // No license (after trial)

/**
 * Trial state information
 */
export interface TrialState {
  readonly startDate: string; // ISO 8601
  readonly daysRemaining: number;
  readonly isExpired: boolean;
}

/**
 * Active license information
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
 * Full application license state
 */
export interface AppLicenseState {
  readonly status: LicenseStatus;
  readonly trial?: TrialState;
  readonly license?: ActiveLicense;
}

/**
 * Result of license validation
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly error?: string;
  readonly license?: LicenseFile;
}

/**
 * Stored trial data (persisted locally)
 */
export interface StoredTrialData {
  readonly startDate: string;
}

/**
 * Stored license data (persisted locally)
 */
export interface StoredLicenseData {
  readonly license: LicenseFile;
  readonly activatedAt: string;
}

/**
 * Public key for signature verification
 */
export interface PublicKeyConfig {
  readonly publicKey: string; // Hex-encoded Ed25519 public key
}
