/**
 * AI Key Storage Service
 *
 * Securely stores AI provider API keys using Electron's safeStorage API.
 * Keys are encrypted with OS-level security (Keychain on macOS, DPAPI on
 * Windows, libsecret on Linux). All provider keys live in a single
 * encrypted file as a JSON map:
 *
 *   { "anthropic": "sk-ant-...", "openai": "sk-..." }
 *
 * Error handling philosophy:
 * - ENOENT on read → no keys yet, return empty map. Safe.
 * - "Encryption not available" on read OR write → throw a typed error;
 *   the caller decides whether to surface it. We do NOT delete the
 *   stored file in this case — safeStorage may simply be unavailable
 *   temporarily (locked keychain on macOS after sleep, libsecret not
 *   running, etc.). Deleting would cause silent data loss.
 * - Decryption / JSON parse failure → throw `AiKeyDecryptionError`.
 *   The previous implementation auto-cleared the file on any decrypt
 *   error, which is a footgun: if the user's keychain is temporarily
 *   inaccessible, their keys would vanish.
 *
 * @module AiKeyStorage
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { safeStorage } from 'electron';

type KeyMap = Record<string, string>;

export class AiKeyEncryptionUnavailableError extends Error {
  constructor() {
    super(
      'Encryption is not available on this system. ' +
        'On Linux, ensure libsecret (gnome-keyring / kwallet) is running.'
    );
    this.name = 'AiKeyEncryptionUnavailableError';
  }
}

export class AiKeyDecryptionError extends Error {
  readonly cause: unknown;
  constructor(cause: unknown) {
    super(
      'Failed to decrypt AI keys. The OS keychain may be locked or the ' +
        'encrypted file may be corrupt. The stored file was left in place.'
    );
    this.name = 'AiKeyDecryptionError';
    this.cause = cause;
  }
}

export class AiKeyStorage {
  private readonly filePath: string;

  /**
   * @param dataDir - User data directory path (e.g. `app.getPath('userData')`)
   */
  constructor(dataDir: string) {
    this.filePath = join(dataDir, 'ai-keys.encrypted');
  }

  async saveKey(provider: string, apiKey: string): Promise<void> {
    const keys = await this.readKeys();
    keys[provider] = apiKey;
    await this.writeKeys(keys);
  }

  async getKey(provider: string): Promise<string | null> {
    const keys = await this.readKeys();
    return keys[provider] ?? null;
  }

  async removeKey(provider: string): Promise<void> {
    const keys = await this.readKeys();
    delete keys[provider];

    // If no keys remain, remove the file entirely.
    if (Object.keys(keys).length === 0) {
      await this.unlinkFile();
      return;
    }

    await this.writeKeys(keys);
  }

  async hasKey(provider: string): Promise<boolean> {
    const keys = await this.readKeys();
    return provider in keys;
  }

  async listProviders(): Promise<string[]> {
    const keys = await this.readKeys();
    return Object.keys(keys);
  }

  /**
   * Read and decrypt the key map.
   *
   * Returns `{}` if no file exists yet. Throws on every other failure mode
   * so the caller can decide how to surface the problem instead of silently
   * losing state.
   */
  private async readKeys(): Promise<KeyMap> {
    let encrypted: Buffer;
    try {
      encrypted = await fs.readFile(this.filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      throw error;
    }

    if (!safeStorage.isEncryptionAvailable()) {
      throw new AiKeyEncryptionUnavailableError();
    }

    let plaintext: string;
    try {
      plaintext = safeStorage.decryptString(encrypted);
    } catch (cause) {
      throw new AiKeyDecryptionError(cause);
    }

    let keys: unknown;
    try {
      keys = JSON.parse(plaintext);
    } catch (cause) {
      throw new AiKeyDecryptionError(cause);
    }

    if (typeof keys !== 'object' || keys === null || Array.isArray(keys)) {
      throw new AiKeyDecryptionError(new Error('Decrypted payload is not a JSON object'));
    }

    // We trust the shape because we wrote it. The handler boundary
    // (defineIpcHandler in aiKeyHandlers.ts) already validates keys
    // before they're written, so the saved map only contains strings.
    return keys as KeyMap;
  }

  private async writeKeys(keys: KeyMap): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new AiKeyEncryptionUnavailableError();
    }

    const plaintext = JSON.stringify(keys);
    const encrypted = safeStorage.encryptString(plaintext);
    await fs.writeFile(this.filePath, encrypted);
  }

  private async unlinkFile(): Promise<void> {
    try {
      await fs.unlink(this.filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
