/**
 * Token Storage Service
 *
 * Securely stores JWT tokens using Electron's safeStorage API.
 * Tokens are encrypted with OS-level security (Keychain on macOS, DPAPI on Windows, libsecret on Linux).
 *
 * @module TokenStorage
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { safeStorage } from 'electron';

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
    let encrypted: Buffer;
    try {
      encrypted = await fs.readFile(this.filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist - no tokens saved yet
        return null;
      }
      // Unexpected read error — treat as "no usable tokens right now" without
      // destroying the file.
      return null;
    }

    try {
      const plaintext = safeStorage.decryptString(encrypted);
      const parsed = JSON.parse(plaintext) as unknown;
      // Validate shape AND field types before trusting the payload.
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        typeof (parsed as Tokens).accessToken !== 'string' ||
        typeof (parsed as Tokens).refreshToken !== 'string'
      ) {
        return null;
      }
      return parsed as Tokens;
    } catch {
      // DATA SAFETY: decryption/parse failed. This is frequently transient —
      // the OS keychain can be temporarily locked (e.g. right after wake on
      // macOS, or libsecret not yet running on Linux). The previous behavior
      // deleted the encrypted file here, which permanently logged the user out
      // on a momentary keychain hiccup. Instead, leave the file intact and
      // report "no tokens" for now; a later call with an unlocked keychain
      // recovers them. Explicit logout still clears via clearTokens().
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
