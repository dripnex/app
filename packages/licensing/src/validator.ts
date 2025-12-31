import * as ed from '@noble/ed25519';
import type { LicenseFile, ValidationResult, PublicKeyConfig } from './types.js';

/**
 * Default public key for production use
 * Replace with actual key in production
 */
const DEFAULT_PUBLIC_KEY =
  '0000000000000000000000000000000000000000000000000000000000000000';

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
 * Converts a base64 string to Uint8Array
 */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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
    const message = new TextEncoder().encode(getLicensePayload(license));

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
  const message = new TextEncoder().encode(payload);
  const signature = await ed.signAsync(message, privateKey);

  // Convert signature to base64
  const signatureBase64 = btoa(String.fromCharCode(...signature));

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
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);

  const toHex = (bytes: Uint8Array): string =>
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

  return {
    publicKey: toHex(publicKey),
    privateKey: toHex(privateKey),
  };
}
