import type {
  StoredTrialData,
  StoredLicenseData,
  StoredSubscriptionData,
  LicenseFile,
} from './types.js';

/**
 * Interface for license storage operations
 * Implemented by the desktop app with actual file system access
 */
export interface LicenseStorage {
  /**
   * Reads trial data from storage
   */
  readTrialData(): Promise<StoredTrialData | null>;

  /**
   * Writes trial data to storage
   */
  writeTrialData(data: StoredTrialData): Promise<void>;

  /**
   * Reads license data from storage
   */
  readLicenseData(): Promise<StoredLicenseData | null>;

  /**
   * Writes license data to storage
   */
  writeLicenseData(data: StoredLicenseData): Promise<void>;

  /**
   * Removes license data from storage
   */
  removeLicenseData(): Promise<void>;

  /**
   * Reads cached subscription data from storage
   */
  readSubscriptionData(): Promise<StoredSubscriptionData | null>;

  /**
   * Writes subscription data to storage
   */
  writeSubscriptionData(data: StoredSubscriptionData): Promise<void>;

  /**
   * Removes subscription data from storage
   */
  removeSubscriptionData(): Promise<void>;
}

/**
 * In-memory implementation for testing
 */
export class InMemoryLicenseStorage implements LicenseStorage {
  private trialData: StoredTrialData | null = null;
  private licenseData: StoredLicenseData | null = null;
  private subscriptionData: StoredSubscriptionData | null = null;

  async readTrialData(): Promise<StoredTrialData | null> {
    return this.trialData;
  }

  async writeTrialData(data: StoredTrialData): Promise<void> {
    this.trialData = data;
  }

  async readLicenseData(): Promise<StoredLicenseData | null> {
    return this.licenseData;
  }

  async writeLicenseData(data: StoredLicenseData): Promise<void> {
    this.licenseData = data;
  }

  async removeLicenseData(): Promise<void> {
    this.licenseData = null;
  }

  async readSubscriptionData(): Promise<StoredSubscriptionData | null> {
    return this.subscriptionData;
  }

  async writeSubscriptionData(data: StoredSubscriptionData): Promise<void> {
    this.subscriptionData = data;
  }

  async removeSubscriptionData(): Promise<void> {
    this.subscriptionData = null;
  }

  /**
   * Resets all stored data (for testing)
   */
  reset(): void {
    this.trialData = null;
    this.licenseData = null;
    this.subscriptionData = null;
  }
}

/**
 * Creates stored license data from a validated license
 *
 * @param license - Validated license file
 * @param now - Current date (for testing)
 * @returns License data ready for storage
 */
export function createStoredLicenseData(
  license: LicenseFile,
  now: Date = new Date()
): StoredLicenseData {
  return {
    license,
    activatedAt: now.toISOString(),
  };
}

/**
 * Checks if stored license data is valid (not tampered with)
 *
 * @param data - Stored license data
 * @returns True if data appears valid
 */
export function isStoredLicenseDataValid(
  data: StoredLicenseData | null
): data is StoredLicenseData {
  if (!data) return false;
  if (!data.license) return false;
  if (typeof data.activatedAt !== 'string') return false;

  // Basic structure check
  const license = data.license;
  return (
    license.licenseVersion === 1 &&
    typeof license.licenseId === 'string' &&
    typeof license.signature === 'string'
  );
}
