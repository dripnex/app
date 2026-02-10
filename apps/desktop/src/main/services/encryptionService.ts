/**
 * Encryption Service
 *
 * Provides E2E encryption for note content using AES-256-GCM.
 * Encryption key is stored securely using Electron's safeStorage.
 *
 * @module EncryptionService
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { join } from 'path';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { safeStorage } from 'electron';

// ============================================================================
// Constants
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const KEY_LENGTH = 32; // 256 bits

// ============================================================================
// EncryptionService Class
// ============================================================================

export class EncryptionService {
  private key: Buffer | null = null;
  private readonly keyPath: string;

  constructor(dataDir: string) {
    this.keyPath = join(dataDir, 'encryption.key');
  }

  /**
   * Initialize encryption service
   * Loads or generates encryption key
   */
  async initialize(): Promise<void> {
    if (this.key) {
      return; // Already initialized
    }

    try {
      // Try to load existing key
      if (existsSync(this.keyPath)) {
        const encryptedKey = await readFile(this.keyPath);
        const keyBuffer = safeStorage.decryptString(encryptedKey);
        this.key = Buffer.from(keyBuffer, 'hex');
      } else {
        // Generate new key
        await this.generateKey();
      }
    } catch (error) {
      throw new Error(
        `Failed to initialize encryption: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate and store a new encryption key
   */
  private async generateKey(): Promise<void> {
    // Generate random key
    this.key = randomBytes(KEY_LENGTH);

    // Encrypt key using OS keychain
    const keyHex = this.key.toString('hex');
    const encryptedKey = safeStorage.encryptString(keyHex);

    // Save encrypted key to disk
    await writeFile(this.keyPath, encryptedKey);
  }

  /**
   * Encrypt plaintext content using AES-256-GCM
   * Format: {iv}:{ciphertext}:{authTag} (all base64 encoded)
   */
  async encrypt(plaintext: string): Promise<string> {
    if (!this.key) {
      throw new Error('Encryption service not initialized');
    }

    try {
      // Generate random IV (initialization vector)
      const iv = randomBytes(IV_LENGTH);

      // Create cipher
      const cipher = createCipheriv(ALGORITHM, this.key, iv);

      // Encrypt
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Format: iv:ciphertext:authTag (all base64)
      const result = [
        iv.toString('base64'),
        encrypted.toString('base64'),
        authTag.toString('base64'),
      ].join(':');

      return result;
    } catch (error) {
      throw new Error(
        `Failed to encrypt content: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Decrypt encrypted content using AES-256-GCM
   * Expects format: {iv}:{ciphertext}:{authTag} (all base64 encoded)
   */
  async decrypt(ciphertext: string): Promise<string> {
    if (!this.key) {
      throw new Error('Encryption service not initialized');
    }

    try {
      // Parse encrypted format
      const parts = ciphertext.split(':');
      if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
        throw new Error('Invalid encrypted format');
      }

      const iv = Buffer.from(parts[0], 'base64');
      const encrypted = Buffer.from(parts[1], 'base64');
      const authTag = Buffer.from(parts[2], 'base64');

      // Create decipher
      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

      return decrypted.toString('utf-8');
    } catch (error) {
      throw new Error(
        `Failed to decrypt content: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if content is encrypted (for migration purposes)
   * Checks for proper encryption format: {base64}:{base64}:{base64}
   */
  isEncrypted(content: string): boolean {
    try {
      const parts = content.split(':');
      if (parts.length !== 3) {
        return false;
      }

      // Check if all parts are valid base64
      for (const part of parts) {
        Buffer.from(part, 'base64');
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Re-encrypt content with a new key (for key rotation)
   */
  async reEncrypt(oldCiphertext: string, newKey: Buffer): Promise<string> {
    // Decrypt with current key
    const plaintext = await this.decrypt(oldCiphertext);

    // Temporarily swap keys
    const oldKey = this.key;
    this.key = newKey;

    try {
      // Encrypt with new key
      const newCiphertext = await this.encrypt(plaintext);
      return newCiphertext;
    } finally {
      // Restore old key
      this.key = oldKey;
    }
  }

  /**
   * Export encryption key (for backup purposes)
   * Returns hex-encoded key
   */
  exportKey(): string {
    if (!this.key) {
      throw new Error('Encryption service not initialized');
    }
    return this.key.toString('hex');
  }

  /**
   * Import encryption key from hex string (for restore purposes)
   */
  async importKey(keyHex: string): Promise<void> {
    try {
      this.key = Buffer.from(keyHex, 'hex');

      // Save imported key
      const encryptedKey = safeStorage.encryptString(keyHex);
      await writeFile(this.keyPath, encryptedKey);
    } catch (error) {
      throw new Error(
        `Failed to import key: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
