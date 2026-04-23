import * as ed from '@noble/ed25519';
import type {
  LicenseFile,
  ValidationResult,
  PublicKeyConfig,
  VerificationResult,
  SubscriptionInfo,
  StoredSubscriptionData,
} from './types.js';

/**
 * Default public key for production use
 * Replace with actual key in production
 */
const DEFAULT_PUBLIC_KEY = '808de62a74a99bc70bf16f9df1ce3a7d6417e8d8479a6193df2bc28e6d510517';

/**
 * Extracts the payload portion of a license for signature verification
 */
function getLicensePayload(license: LicenseFile): string {
  const payload = {
    licenseVersion: license.licenseVersion,
    licenseId: license.licenseId,
    issuedTo: license.issuedTo,
    purchaseDate: license.purchaseDate,
    updatesUntil: license.updatesUntil,
    plan: license.plan,
    capabilities: license.capabilities,
  };
  return JSON.stringify(payload);
}

/**
 * Converts a hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Converts a base64 string to Uint8Array (Node.js compatible)
 */
function base64ToBytes(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/**
 * Converts Uint8Array to base64 string (Node.js compatible)
 */
function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

/**
 * Converts string to Uint8Array (Node.js compatible)
 */
function stringToBytes(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, 'utf-8'));
}

/**
 * Validates a license file structure without verifying signature
 */
function validateLicenseStructure(data: unknown): data is LicenseFile {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const license = data as Record<string, unknown>;

  return (
    license.licenseVersion === 1 &&
    typeof license.licenseId === 'string' &&
    typeof license.issuedTo === 'string' &&
    typeof license.purchaseDate === 'string' &&
    typeof license.updatesUntil === 'string' &&
    license.plan === 'pro' &&
    Array.isArray(license.capabilities) &&
    typeof license.signature === 'string'
  );
}

/**
 * Validates a license file with Ed25519 signature verification
 *
 * @param licenseData - Raw license data (parsed JSON)
 * @param config - Optional public key configuration
 * @returns Validation result with license if valid
 */
export async function validateLicense(
  licenseData: unknown,
  config?: PublicKeyConfig
): Promise<ValidationResult> {
  // Validate structure first
  if (!validateLicenseStructure(licenseData)) {
    return {
      valid: false,
      error: 'Invalid license format',
    };
  }

  const license = licenseData as LicenseFile;

  // Validate dates
  const purchaseDate = new Date(license.purchaseDate);
  const updatesUntil = new Date(license.updatesUntil);

  if (isNaN(purchaseDate.getTime())) {
    return {
      valid: false,
      error: 'Invalid purchase date',
    };
  }

  if (isNaN(updatesUntil.getTime())) {
    return {
      valid: false,
      error: 'Invalid updates until date',
    };
  }

  // Verify Ed25519 signature
  try {
    const publicKeyHex = config?.publicKey ?? DEFAULT_PUBLIC_KEY;
    const publicKey = hexToBytes(publicKeyHex);
    const signature = base64ToBytes(license.signature);
    const message = stringToBytes(getLicensePayload(license));

    const isValid = await ed.verifyAsync(signature, message, publicKey);

    if (!isValid) {
      return {
        valid: false,
        error: 'Invalid license signature',
      };
    }
  } catch {
    return {
      valid: false,
      error: 'Signature verification failed',
    };
  }

  return {
    valid: true,
    license,
  };
}

/**
 * Parses and validates a license from JSON string
 *
 * @param jsonString - License file contents as JSON string
 * @param config - Optional public key configuration
 * @returns Validation result with license if valid
 */
export async function parseLicenseFile(
  jsonString: string,
  config?: PublicKeyConfig
): Promise<ValidationResult> {
  try {
    const data = JSON.parse(jsonString);
    return validateLicense(data, config);
  } catch {
    return {
      valid: false,
      error: 'Invalid JSON format',
    };
  }
}

/**
 * Signs a license payload with Ed25519 private key
 * For use by the license generation server (not in client)
 *
 * @param license - License data without signature
 * @param privateKeyHex - Hex-encoded Ed25519 private key
 * @returns Complete license with signature
 */
export async function signLicense(
  license: Omit<LicenseFile, 'signature'>,
  privateKeyHex: string
): Promise<LicenseFile> {
  const privateKey = hexToBytes(privateKeyHex);
  const payload = getLicensePayload(license as LicenseFile);
  const message = stringToBytes(payload);
  const signature = await ed.signAsync(message, privateKey);

  // Convert signature to base64
  const signatureBase64 = bytesToBase64(signature);

  return {
    ...license,
    signature: signatureBase64,
  };
}

/**
 * Generates a new Ed25519 keypair for license signing
 * For use during initial setup (not in client)
 *
 * @returns Object with hex-encoded public and private keys
 */
export async function generateKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  const privateKey =
    'randomSecretKey' in ed.utils
      ? (ed.utils as unknown as { randomSecretKey: () => Uint8Array }).randomSecretKey()
      : (ed.utils as unknown as { randomPrivateKey: () => Uint8Array }).randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);

  const toHex = (bytes: Uint8Array): string =>
    Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

  return {
    publicKey: toHex(publicKey),
    privateKey: toHex(privateKey),
  };
}

// ============================================================================
// Subscription Verification
// ============================================================================

/**
 * Checks if a subscription is currently active
 *
 * @param subscription - Subscription info to check
 * @returns True if subscription is active and not expired
 */
export function isSubscriptionActive(subscription: SubscriptionInfo): boolean {
  const now = new Date();
  const periodEnd = new Date(subscription.currentPeriodEnd);

  // Subscription is active if:
  // 1. Status is 'active' or 'past_due' (grace period)
  // 2. Current period has not ended
  // 3. Not marked for cancellation (or still within current period if canceled)
  const isWithinPeriod = periodEnd > now;
  const isActiveStatus = subscription.status === 'active' || subscription.status === 'past_due';

  return isActiveStatus && isWithinPeriod;
}

/**
 * Verifies subscription data received from the server
 *
 * @param data - Raw subscription data to verify
 * @returns Verification result with subscription if valid
 */
export function verifySubscription(data: unknown): VerificationResult {
  // Validate structure
  if (typeof data !== 'object' || data === null) {
    return {
      valid: false,
      error: 'Invalid subscription data format',
    };
  }

  const sub = data as Record<string, unknown>;

  // Check required fields
  if (
    typeof sub.subscriptionId !== 'string' ||
    typeof sub.customerId !== 'string' ||
    typeof sub.email !== 'string' ||
    (sub.plan !== 'monthly' && sub.plan !== 'annual') ||
    typeof sub.status !== 'string' ||
    typeof sub.currentPeriodStart !== 'string' ||
    typeof sub.currentPeriodEnd !== 'string' ||
    typeof sub.cancelAtPeriodEnd !== 'boolean'
  ) {
    return {
      valid: false,
      error: 'Missing or invalid subscription fields',
    };
  }

  const subscription = sub as unknown as SubscriptionInfo;

  // Validate dates
  const periodStart = new Date(subscription.currentPeriodStart);
  const periodEnd = new Date(subscription.currentPeriodEnd);

  if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
    return {
      valid: false,
      error: 'Invalid subscription dates',
    };
  }

  if (periodEnd <= periodStart) {
    return {
      valid: false,
      error: 'Invalid subscription period (end date must be after start date)',
    };
  }

  // Check if subscription is active
  if (!isSubscriptionActive(subscription)) {
    return {
      valid: false,
      error: 'Subscription is not active or has expired',
    };
  }

  return {
    valid: true,
    subscription,
  };
}

/**
 * Checks if cached subscription data is still valid
 *
 * @param stored - Stored subscription data with cache metadata
 * @returns True if cache is still valid and subscription is active
 */
export function isCachedSubscriptionValid(stored: StoredSubscriptionData): boolean {
  const now = new Date();
  const cacheExpires = new Date(stored.cacheExpiresAt);

  // Cache expired, need to re-verify with server
  if (cacheExpires <= now) {
    return false;
  }

  // Cache is valid, check if subscription itself is active
  return isSubscriptionActive(stored.subscription);
}

/**
 * Creates stored subscription data with cache metadata
 *
 * @param subscription - Verified subscription info
 * @param cacheDurationMs - Cache duration in milliseconds (default: 1 hour)
 * @returns Stored subscription data with cache expiration
 */
export function createStoredSubscription(
  subscription: SubscriptionInfo,
  cacheDurationMs = 3600000 // 1 hour default
): StoredSubscriptionData {
  const now = new Date();
  const cacheExpires = new Date(now.getTime() + cacheDurationMs);

  return {
    subscription,
    lastVerified: now.toISOString(),
    cacheExpiresAt: cacheExpires.toISOString(),
  };
}
