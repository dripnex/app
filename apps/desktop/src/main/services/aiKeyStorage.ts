/**
 * AI Key Storage Service
 *
 * Securely stores AI provider API keys using Electron's safeStorage API.
 * Keys are encrypted with OS-level security (Keychain on macOS, DPAPI on Windows, libsecret on Linux).
 *
 * All provider keys are stored in a single encrypted file as a JSON map:
 * { "anthropic": "sk-ant-...", "openai": "sk-..." }
 *
 * @module AiKeyStorage
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { safeStorage } from 'electron';

// ============================================================================
// Types
// ============================================================================

/** Map of provider name to API key */
type KeyMap = Record<string, string>;

// ============================================================================
// AiKeyStorage Class
// ============================================================================

export class AiKeyStorage {
  private readonly filePath: string;

  /**
   * Creates a new AiKeyStorage instance
   * @param dataDir - User data directory path (e.g., app.getPath('userData'))
   */
  constructor(dataDir: string) {
    this.filePath = join(dataDir, 'ai-keys.encrypted');
  }

  /**
   * Saves an API key for a provider
   * @param provider - Provider identifier (e.g., 'anthropic', 'openai')
   * @param apiKey - The API key to store
   */
  async saveKey(provider: string, apiKey: string): Promise<void> {
    const keys = await this.readKeys();
    keys[provider] = apiKey;
    await this.writeKeys(keys);
  }

  /**
   * Retrieves an API key for a provider
   * @param provider - Provider identifier
   * @returns API key string or null if not found
   */
  async getKey(provider: string): Promise<string | null> {
    const keys = await this.readKeys();
    return keys[provider] ?? null;
  }

  /**
   * Removes an API key for a provider
   * @param provider - Provider identifier
   */
  async removeKey(provider: string): Promise<void> {
    const keys = await this.readKeys();
    delete keys[provider];

    // If no keys remain, remove the file entirely
    if (Object.keys(keys).length === 0) {
      await this.clearAll();
      return;
    }

    await this.writeKeys(keys);
  }

  /**
   * Checks if a key exists for a provider
   * @param provider - Provider identifier
   * @returns true if a key is stored for this provider
   */
  async hasKey(provider: string): Promise<boolean> {
    const keys = await this.readKeys();
    return provider in keys;
  }

  /**
   * Lists all providers that have stored keys
   * @returns Array of provider identifiers
   */
  async listProviders(): Promise<string[]> {
    const keys = await this.readKeys();
    return Object.keys(keys);
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  /**
   * Reads and decrypts the key map from disk
   * @returns Parsed key map, or empty object if file doesn't exist
   */
  private async readKeys(): Promise<KeyMap> {
    try {
      const encrypted = await fs.readFile(this.filePath);
      const plaintext = safeStorage.decryptString(encrypted);
      const keys = JSON.parse(plaintext) as KeyMap;

      // Validate structure: must be a plain object with string values
      if (typeof keys !== 'object' || keys === null || Array.isArray(keys)) {
        throw new Error('Invalid key map structure');
      }

      return keys;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist - no keys saved yet
        return {};
      }
      // Decryption or parsing failed - clear corrupted file
      await this.clearAll();
      return {};
    }
  }

  /**
   * Encrypts and writes the key map to disk
   * @param keys - The key map to persist
   */
  private async writeKeys(keys: KeyMap): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption is not available on this system');
    }

    const plaintext = JSON.stringify(keys);
    const encrypted = safeStorage.encryptString(plaintext);
    await fs.writeFile(this.filePath, encrypted);
  }

  /**
   * Removes the encrypted file from disk
   */
  private async clearAll(): Promise<void> {
    try {
      await fs.unlink(this.filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist - already clear
    }
  }
}
