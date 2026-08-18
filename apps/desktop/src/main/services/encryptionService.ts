/**
 * Encryption Service
 *
 * Provides E2E encryption for note content using AES-256-GCM with a
 * key hierarchy: Passphrase → Master Key (MK) → Content Encryption Key (CEK).
 *
 * Key hierarchy:
 * - Passphrase: chosen by user, never stored
 * - Master Key (MK): derived via PBKDF2(passphrase, salt, 600k iterations)
 * - Content Encryption Key (CEK): random AES-256 key, wrapped with MK
 * - CEK is cached locally via Electron safeStorage
 *
 * The server stores only: salt, wrappedCEK, wrappedCEK_recovery, kdfParams.
 * It never sees MK, CEK, or plaintext content.
 *
 * @module EncryptionService
 */

import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'crypto';
import { join } from 'path';
import { readFile, writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { safeStorage } from 'electron';

// ============================================================================
// Constants
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const KEY_LENGTH = 32; // 256 bits
const SALT_LENGTH = 32; // 256 bits
const KDF_ITERATIONS = 600_000;
const KDF_HASH = 'sha256';

// AES Key Wrap (RFC 3394) default IV
const AES_KW_DEFAULT_IV = Buffer.from('A6A6A6A6A6A6A6A6', 'hex');

// ============================================================================
// KDF Parameters
// ============================================================================

export interface KdfParams {
  algorithm: string;
  iterations: number;
  hash: string;
}

export const DEFAULT_KDF_PARAMS: KdfParams = {
  algorithm: 'pbkdf2',
  iterations: KDF_ITERATIONS,
  hash: KDF_HASH,
};

// ============================================================================
// Key Setup Result
// ============================================================================

export interface KeySetupResult {
  salt: string; // Base64
  wrappedCek: string; // Base64
  wrappedCekRecovery: string | null; // Base64
  recoveryKey: string | null; // Hex string shown once to user
  kdfParams: KdfParams;
}

// ============================================================================
// EncryptionService Class
// ============================================================================

export class EncryptionService {
  private key: Buffer | null = null; // The active CEK
  private readonly cekCachePath: string;
  private readonly legacyKeyPath: string;

  constructor(dataDir: string) {
    this.cekCachePath = join(dataDir, 'cek.cache');
    this.legacyKeyPath = join(dataDir, 'encryption.key');
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize encryption service.
   * Tries to load cached CEK from safeStorage.
   * Returns true if CEK is available, false if passphrase setup is needed.
   */
  async initialize(): Promise<boolean> {
    if (this.key) {
      return true;
    }

    const cached = await this.readCachedKey(this.cekCachePath);
    if (cached) {
      this.key = cached;
      return true;
    }

    const legacy = await this.readCachedKey(this.legacyKeyPath);
    if (legacy) {
      this.key = legacy;
      return true;
    }

    return false;
  }

  /**
   * Check if a CEK is loaded and ready for encrypt/decrypt operations.
   */
  isReady(): boolean {
    return this.key !== null;
  }

  // ==========================================================================
  // Key Hierarchy — First Device Setup
  // ==========================================================================

  /**
   * Set up encryption keys for the first time (first device).
   * Generates CEK, wraps it with passphrase-derived MK, returns data to upload to server.
   */
  async setupKeys(passphrase: string): Promise<KeySetupResult> {
    // Generate salt and CEK
    const salt = randomBytes(SALT_LENGTH);
    const cek = randomBytes(KEY_LENGTH);

    // Derive Master Key from passphrase
    const mk = this.deriveKey(passphrase, salt, DEFAULT_KDF_PARAMS);

    // Wrap CEK with MK
    const wrappedCek = this.wrapKey(mk, cek);

    // Generate recovery key and wrap CEK with it
    const recoveryKeyBuf = randomBytes(KEY_LENGTH);
    const recoveryKey = recoveryKeyBuf.toString('hex');
    const wrappedCekRecovery = this.wrapKey(recoveryKeyBuf, cek);

    // Cache CEK locally
    await this.cacheCek(cek);
    this.key = cek;

    return {
      salt: salt.toString('base64'),
      wrappedCek: wrappedCek.toString('base64'),
      wrappedCekRecovery: wrappedCekRecovery.toString('base64'),
      recoveryKey,
      kdfParams: DEFAULT_KDF_PARAMS,
    };
  }

  // ==========================================================================
  // Key Hierarchy — New Device Setup
  // ==========================================================================

  /**
   * Unlock encryption on a new device using passphrase + server data.
   * Derives MK from passphrase, unwraps CEK, caches it locally.
   * Throws if passphrase is wrong (unwrap fails).
   */
  async unlockWithPassphrase(
    passphrase: string,
    salt: string,
    wrappedCek: string,
    kdfParams: KdfParams
  ): Promise<void> {
    const saltBuf = Buffer.from(salt, 'base64');
    const wrappedCekBuf = Buffer.from(wrappedCek, 'base64');

    // Derive MK from passphrase
    const mk = this.deriveKey(passphrase, saltBuf, kdfParams);

    // Unwrap CEK — throws if passphrase is wrong
    const cek = this.unwrapKey(mk, wrappedCekBuf);

    // Cache CEK locally
    await this.cacheCek(cek);
    this.key = cek;
  }

  /**
   * Unlock encryption using recovery key + server data.
   */
  async unlockWithRecoveryKey(recoveryKeyHex: string, wrappedCekRecovery: string): Promise<void> {
    // Validate hex string before parsing — reject malformed input early
    const normalized = recoveryKeyHex.replace(/[\s-]/g, '').toLowerCase();
    if (!/^[0-9a-f]+$/.test(normalized) || normalized.length !== KEY_LENGTH * 2) {
      throw new Error('Invalid recovery key format — expected 64 hex characters');
    }
    const recoveryKeyBuf = Buffer.from(normalized, 'hex');
    const wrappedBuf = Buffer.from(wrappedCekRecovery, 'base64');

    const cek = this.unwrapKey(recoveryKeyBuf, wrappedBuf);

    await this.cacheCek(cek);
    this.key = cek;
  }

  // ==========================================================================
  // Passphrase Change
  // ==========================================================================

  /**
   * Change passphrase — re-wraps CEK with new MK.
   * Returns new server data to upload.
   */
  async changePassphrase(newPassphrase: string): Promise<{
    salt: string;
    wrappedCek: string;
    kdfParams: KdfParams;
  }> {
    if (!this.key) {
      throw new Error('CEK not loaded — cannot change passphrase');
    }

    const salt = randomBytes(SALT_LENGTH);
    const mk = this.deriveKey(newPassphrase, salt, DEFAULT_KDF_PARAMS);
    const wrappedCek = this.wrapKey(mk, this.key);

    return {
      salt: salt.toString('base64'),
      wrappedCek: wrappedCek.toString('base64'),
      kdfParams: DEFAULT_KDF_PARAMS,
    };
  }

  // ==========================================================================
  // Encrypt / Decrypt (unchanged interface)
  // ==========================================================================

  /**
   * Encrypt plaintext content using AES-256-GCM.
   * Format: {iv}:{ciphertext}:{authTag} (all base64 encoded)
   */
  async encrypt(plaintext: string): Promise<string> {
    if (!this.key) {
      throw new Error('Encryption service not initialized');
    }

    try {
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv(ALGORITHM, this.key, iv);
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
      const authTag = cipher.getAuthTag();

      return [iv.toString('base64'), encrypted.toString('base64'), authTag.toString('base64')].join(
        ':'
      );
    } catch (error) {
      throw new Error(
        `Failed to encrypt content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { cause: error }
      );
    }
  }

  /**
   * Decrypt encrypted content using AES-256-GCM.
   * Expects format: {iv}:{ciphertext}:{authTag} (all base64 encoded)
   */
  async decrypt(ciphertext: string): Promise<string> {
    if (!this.key) {
      throw new Error('Encryption service not initialized');
    }

    try {
      const parts = ciphertext.split(':');
      if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
        throw new Error('Invalid encrypted format');
      }

      const iv = Buffer.from(parts[0], 'base64');
      const encrypted = Buffer.from(parts[1], 'base64');
      const authTag = Buffer.from(parts[2], 'base64');

      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

      return decrypted.toString('utf-8');
    } catch (error) {
      throw new Error(
        `Failed to decrypt content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { cause: error }
      );
    }
  }

  /**
   * Check if content is encrypted (for migration purposes).
   */
  isEncrypted(content: string): boolean {
    try {
      const parts = content.split(':');
      if (parts.length !== 3) {
        return false;
      }
      for (const part of parts) {
        Buffer.from(part, 'base64');
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Re-encrypt content with a new key (for key rotation / migration).
   */
  async reEncrypt(oldCiphertext: string, newKey: Buffer): Promise<string> {
    const plaintext = await this.decrypt(oldCiphertext);
    const oldKey = this.key;
    this.key = newKey;
    try {
      return await this.encrypt(plaintext);
    } finally {
      this.key = oldKey;
    }
  }

  /**
   * Export the current CEK as hex (for backup/migration).
   */
  exportKey(): string {
    if (!this.key) {
      throw new Error('Encryption service not initialized');
    }
    return this.key.toString('hex');
  }

  /**
   * Import a CEK from hex and cache it.
   */
  async importKey(keyHex: string): Promise<void> {
    try {
      if (!/^[0-9a-fA-F]+$/.test(keyHex) || keyHex.length !== KEY_LENGTH * 2) {
        throw new Error(`Invalid key format — expected ${KEY_LENGTH * 2} hex characters`);
      }
      this.key = Buffer.from(keyHex, 'hex');
      await this.cacheCek(this.key);
    } catch (error) {
      throw new Error(
        `Failed to import key: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { cause: error }
      );
    }
  }

  // ==========================================================================
  // Legacy Key Migration
  // ==========================================================================

  /**
   * Check if a legacy per-device key exists (pre-key-hierarchy).
   * Used to detect existing installations that need migration.
   */
  hasLegacyKey(): boolean {
    return existsSync(this.legacyKeyPath) && !existsSync(this.cekCachePath);
  }

  /**
   * Migrate from legacy per-device key to key hierarchy.
   * The legacy key becomes the CEK — it gets wrapped and uploaded to server.
   * Returns setup result (same as setupKeys) to upload to server.
   */
  async migrateLegacyKey(passphrase: string): Promise<KeySetupResult> {
    if (!this.key) {
      throw new Error('Legacy key not loaded');
    }

    const cek = this.key; // Current legacy key becomes the CEK
    const salt = randomBytes(SALT_LENGTH);
    const mk = this.deriveKey(passphrase, salt, DEFAULT_KDF_PARAMS);
    const wrappedCek = this.wrapKey(mk, cek);

    // Generate recovery key
    const recoveryKeyBuf = randomBytes(KEY_LENGTH);
    const recoveryKey = recoveryKeyBuf.toString('hex');
    const wrappedCekRecovery = this.wrapKey(recoveryKeyBuf, cek);

    // Cache as new-format CEK
    await this.cacheCek(cek);

    // Remove legacy key file
    try {
      await unlink(this.legacyKeyPath);
    } catch {
      // Ignore — may not exist
    }

    return {
      salt: salt.toString('base64'),
      wrappedCek: wrappedCek.toString('base64'),
      wrappedCekRecovery: wrappedCekRecovery.toString('base64'),
      recoveryKey,
      kdfParams: DEFAULT_KDF_PARAMS,
    };
  }

  // ==========================================================================
  // Internal — Key Derivation & Wrapping
  // ==========================================================================

  /**
   * Derive a key from passphrase using PBKDF2.
   * Enforces a minimum iteration count to prevent downgrade attacks
   * (e.g. a compromised server sending iterations: 1).
   */
  private deriveKey(passphrase: string, salt: Buffer, params: KdfParams): Buffer {
    const MIN_ITERATIONS = 100_000;
    if (!Number.isInteger(params.iterations) || params.iterations < MIN_ITERATIONS) {
      throw new Error(
        `Unsafe KDF parameters: iterations must be >= ${MIN_ITERATIONS}, got ${params.iterations}`
      );
    }
    return pbkdf2Sync(passphrase, salt, params.iterations, KEY_LENGTH, params.hash);
  }

  /**
   * Wrap a key using AES-256-KW (RFC 3394).
   * Uses Node.js crypto aes-256-wrap with the standard IV.
   */
  private wrapKey(wrappingKey: Buffer, keyToWrap: Buffer): Buffer {
    const cipher = createCipheriv('aes-256-wrap' as string, wrappingKey, AES_KW_DEFAULT_IV);
    return Buffer.concat([cipher.update(keyToWrap), cipher.final()]);
  }

  /**
   * Unwrap a key using AES-256-KW (RFC 3394).
   * Throws if the wrapping key is incorrect.
   */
  private unwrapKey(wrappingKey: Buffer, wrappedKey: Buffer): Buffer {
    try {
      const decipher = createDecipheriv('aes-256-wrap' as string, wrappingKey, AES_KW_DEFAULT_IV);
      return Buffer.concat([decipher.update(wrappedKey), decipher.final()]);
    } catch {
      throw new Error('Failed to unwrap key — incorrect passphrase or corrupted data');
    }
  }

  /**
   * Cache CEK locally using Electron safeStorage.
   */
  private async cacheCek(cek: Buffer): Promise<void> {
    const cekHex = cek.toString('hex');
    const payload = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(cekHex)
      : Buffer.from(cekHex, 'utf8');
    await writeFile(this.cekCachePath, payload, { mode: 0o600 });
  }

  private async readCachedKey(path: string): Promise<Buffer | null> {
    if (!existsSync(path)) return null;
    let data: Buffer;
    try {
      data = await readFile(path);
    } catch {
      return null;
    }

    const asText = data.toString('utf8').trim();
    if (/^[0-9a-f]{64}$/i.test(asText)) {
      return Buffer.from(asText, 'hex');
    }

    if (!safeStorage.isEncryptionAvailable()) {
      return null;
    }

    try {
      return Buffer.from(safeStorage.decryptString(data), 'hex');
    } catch {
      return null;
    }
  }
}
