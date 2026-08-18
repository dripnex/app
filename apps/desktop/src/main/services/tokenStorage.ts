/**
 * Token Storage Service
 *
 * Prefers Electron safeStorage (Keychain / DPAPI / libsecret). When the OS
 * store is unavailable — unsigned electron-vite on macOS, locked keychain,
 * missing libsecret — persist the same JSON with mode 0600 so login still
 * completes. Never delete a file we cannot decrypt: the keychain may come
 * back on the next attempt.
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

const FILE_MODE = 0o600;

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
    const payload = this.encryptOrPlaintext(plaintext);
    await fs.writeFile(this.filePath, payload, { mode: FILE_MODE });
    await fs.chmod(this.filePath, FILE_MODE);
  }

  /**
   * Retrieves tokens from encrypted storage
   * @returns Tokens object or null if not found
   */
  async getTokens(): Promise<Tokens | null> {
    let data: Buffer;
    try {
      data = await fs.readFile(this.filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      // Unexpected read error — treat as "no usable tokens right now" without
      // destroying the file.
      return null;
    }

    const plaintext = this.decryptOrPlaintext(data);
    if (plaintext === null) {
      return null;
    }

    return parseTokens(plaintext);
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

  private encryptOrPlaintext(plaintext: string): Buffer {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(plaintext);
    }

    console.warn(
      '[tokenStorage] OS encryption unavailable; writing session tokens with 0600 permissions'
    );
    return Buffer.from(plaintext, 'utf8');
  }

  private decryptOrPlaintext(data: Buffer): string | null {
    if (looksLikeJsonObject(data)) {
      return data.toString('utf8');
    }

    if (!safeStorage.isEncryptionAvailable()) {
      return null;
    }

    try {
      return safeStorage.decryptString(data);
    } catch {
      // DATA SAFETY: decryption failed. This is frequently transient —
      // the OS keychain can be temporarily locked (e.g. right after wake on
      // macOS, or libsecret not yet running on Linux). Leave the file intact
      // and report "no tokens" for now; a later call with an unlocked
      // keychain recovers them. Explicit logout still clears via clearTokens().
      return null;
    }
  }
}

function looksLikeJsonObject(data: Buffer): boolean {
  for (let i = 0; i < data.length; i += 1) {
    const byte = data[i];
    if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d) {
      continue;
    }
    return byte === 0x7b; // '{'
  }
  return false;
}

function parseTokens(plaintext: string): Tokens | null {
  try {
    const parsed = JSON.parse(plaintext) as unknown;
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
    return null;
  }
}
