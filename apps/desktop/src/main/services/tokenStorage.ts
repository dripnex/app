/**
 * Token Storage Service
 *
 * Securely stores JWT tokens using Electron's safeStorage API.
 * Tokens are encrypted with OS-level security (Keychain on macOS, DPAPI on Windows, libsecret on Linux).
 *
 * @module TokenStorage
 */

import { safeStorage } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';

// ============================================================================
// Types
// ============================================================================

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

// ============================================================================
// TokenStorage Class
// ============================================================================

export class TokenStorage {
  private readonly filePath: string;

  /**
   * Creates a new TokenStorage instance
   * @param dataDir - User data directory path (e.g., app.getPath('userData'))
   */
  constructor(dataDir: string) {
    this.filePath = join(dataDir, 'auth.encrypted');
  }

  /**
   * Saves tokens to encrypted storage
   * @param accessToken - JWT access token (15min expiry)
   * @param refreshToken - JWT refresh token (7d expiry)
   */
  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    const tokens: Tokens = { accessToken, refreshToken };
    const plaintext = JSON.stringify(tokens);

    // Encrypt using OS keychain
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption is not available on this system');
    }

    const encrypted = safeStorage.encryptString(plaintext);
    await fs.writeFile(this.filePath, encrypted);
  }

  /**
   * Retrieves tokens from encrypted storage
   * @returns Tokens object or null if not found
   */
  async getTokens(): Promise<Tokens | null> {
    try {
      const encrypted = await fs.readFile(this.filePath);
      const plaintext = safeStorage.decryptString(encrypted);
      const tokens = JSON.parse(plaintext) as Tokens;

      // Validate structure
      if (!tokens.accessToken || !tokens.refreshToken) {
        throw new Error('Invalid token structure');
      }

      return tokens;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist - no tokens saved yet
        return null;
      }
      // Decryption or parsing failed - clear corrupted file
      await this.clearTokens();
      return null;
    }
  }

  /**
   * Clears all stored tokens
   */
  async clearTokens(): Promise<void> {
    try {
      await fs.unlink(this.filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist - already clear
    }
  }

  /**
   * Checks if tokens are stored
   * @returns true if tokens file exists
   */
  async hasTokens(): Promise<boolean> {
    try {
      await fs.access(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets the access token only (convenience method)
   * @returns Access token string or null
   */
  async getAccessToken(): Promise<string | null> {
    const tokens = await this.getTokens();
    return tokens?.accessToken ?? null;
  }

  /**
   * Gets the refresh token only (convenience method)
   * @returns Refresh token string or null
   */
  async getRefreshToken(): Promise<string | null> {
    const tokens = await this.getTokens();
    return tokens?.refreshToken ?? null;
  }
}
